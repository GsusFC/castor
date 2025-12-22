import { NextRequest } from 'next/server'
import { getSession, canModify } from '@/lib/auth'
import { db, accounts, castAnalytics, accountMembers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { publishCast } from '@/lib/farcaster/client'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, publishCastSchema } from '@/lib/validations'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { calculateTextLength } from '@/lib/url-utils'
import { withLock } from '@/lib/lock'
import { getIdempotencyResponse, setIdempotencyResponse } from '@/lib/idempotency'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const body = await request.json()
    const validation = validate(publishCastSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { accountId, content, channelId, embeds, parentHash, idempotencyKey } = validation.data

    const safeContent = content ?? ''

    const idemKey = idempotencyKey
      ? `publish:${session.userId}:${accountId}:${idempotencyKey}`
      : null

    if (idemKey) {
      const cached = await getIdempotencyResponse(idemKey)
      if (cached) {
        return success(cached.data, cached.status)
      }
    }

    const rateLimit = await checkRateLimit(`publish:${session.userId}`, 'expensive')
    if (!rateLimit.success) {
      console.warn('[Publish] Rate limit exceeded:', session.userId, ip)
      return ApiErrors.rateLimited()
    }

    console.log('[Publish API] Request:', {
      accountId,
      content: safeContent.slice(0, 50),
      channelId,
      embeds,
      parentHash,
    })

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return ApiErrors.notFound('Account')
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, account.id),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!canModify(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return ApiErrors.forbidden('No access to this account')
    }

    if (!account.signerUuid || account.signerStatus !== 'approved') {
      return ApiErrors.validationFailed([
        { field: 'accountId', message: 'Account signer is not approved' },
      ])
    }

    const maxChars = account.isPremium ? 10000 : 1024
    if (calculateTextLength(safeContent) > maxChars) {
      return ApiErrors.validationFailed([
        { field: 'content', message: `Content exceeds ${maxChars} characters` },
      ])
    }

    const maxEmbeds = account.isPremium ? 4 : 2
    if (embeds && embeds.length > maxEmbeds) {
      return ApiErrors.validationFailed([
        {
          field: 'embeds',
          message: `Maximum ${maxEmbeds} embeds allowed${account.isPremium ? '' : ' (upgrade to Pro for 4)'}`,
        },
      ])
    }

    // Preparar embeds - solo extraer URLs válidas
    const embedUrls = embeds?.map((e) => ({ url: e.url })) || []

    console.log('[Publish API] Embeds to send:', embedUrls)

    const publishFn = async () => {
      // Publicar cast
      const result = await publishCast(account.signerUuid, safeContent, {
        embeds: embedUrls.length > 0 ? embedUrls : undefined,
        channelId: channelId || undefined,
        parentHash: parentHash || undefined,
        idempotencyKey: idempotencyKey || undefined,
      })

      console.log('[Publish API] Result:', result)

      if (!result.success) {
        return { error: ApiErrors.externalError('Farcaster', { error: result.error }) }
      }

      // Registrar en analytics (no bloquea la respuesta)
      if (result.hash) {
        db.insert(castAnalytics).values({
          id: crypto.randomUUID(),
          castHash: result.hash,
          accountId: account.id,
          content: safeContent.slice(0, 500),
          likes: 0,
          recasts: 0,
          replies: 0,
          publishedAt: new Date(),
        }).catch(err => console.error('[Analytics] Track error:', err))
      }

      const payload = { hash: result.hash, cast: result.cast }
      const response = success(payload)

      if (idemKey) {
        try {
          await setIdempotencyResponse(idemKey, { status: response.status, data: payload }, 60 * 60 * 24)
        } catch (error) {
          console.warn('[Publish API] Failed to store idempotency response:', error)
        }
      }

      return { response }
    }

    if (!idemKey) {
      const result = await publishFn()
      if ('error' in result) return result.error
      return result.response
    }

    const locked = await withLock(idemKey, async () => {
      const cached = await getIdempotencyResponse(idemKey)
      if (cached) {
        return { type: 'replay' as const, cached }
      }

      const result = await publishFn()
      if ('error' in result) {
        return { type: 'error' as const, error: result.error }
      }

      return { type: 'fresh' as const, response: result.response }
    }, { ttlSeconds: 30 })

    if (!locked.success) {
      return ApiErrors.alreadyExists('Publish already in progress')
    }

    if (locked.result.type === 'replay') {
      return success(locked.result.cached.data, locked.result.cached.status)
    }

    if (locked.result.type === 'error') {
      return locked.result.error
    }

    return locked.result.response
  } catch (error) {
    console.error('[Publish API] Error:', error)
    return ApiErrors.operationFailed('Failed to publish cast', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
 }
