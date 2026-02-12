import { NextRequest } from 'next/server'
import { db, scheduledCasts, threads, castMedia, accounts, accountMembers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { getSession, canModify } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, scheduleThreadSchema } from '@/lib/validations'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { generateId } from '@/lib/utils'
import { calculateTextLength } from '@/lib/url-utils'
import { withLock } from '@/lib/lock'
import { getIdempotencyResponse, setIdempotencyResponse } from '@/lib/idempotency'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const ip = getClientIP(request)
    const body = await request.json()
    const validation = validate(scheduleThreadSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { accountId, channelId, scheduledAt, casts, idempotencyKey } = validation.data

    const idemKey = idempotencyKey
      ? `schedule-thread:${session.userId}:${accountId}:${idempotencyKey}`
      : null

    if (idemKey) {
      const cached = await getIdempotencyResponse(idemKey)
      if (cached) {
        return success(cached.data, cached.status)
      }
    }

    const rateLimit = await checkRateLimit(`schedule-thread:${session.userId}`, 'api')
    if (!rateLimit.success) {
      console.warn('[ScheduleThread] Rate limit exceeded:', session.userId, ip)
      return ApiErrors.rateLimited()
    }

    const scheduledDate = new Date(scheduledAt)
    if (Number.isNaN(scheduledDate.getTime())) {
      return ApiErrors.validationFailed([{ field: 'scheduledAt', message: 'Invalid scheduledAt' }])
    }

    if (scheduledDate <= new Date()) {
      return ApiErrors.validationFailed([{ field: 'scheduledAt', message: 'Scheduled time must be in the future' }])
    }

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return ApiErrors.notFound('Account')
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!canModify(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return ApiErrors.forbidden('No access to this account')
    }

    if (account.signerStatus !== 'approved') {
      return ApiErrors.validationFailed([
        { field: 'accountId', message: 'Account signer is not approved' },
      ])
    }

    const maxChars = account.isPremium ? 10000 : 1024
    const maxEmbeds = account.isPremium ? 4 : 2

    for (let i = 0; i < casts.length; i++) {
      const cast = casts[i]
      if (calculateTextLength(cast.content) > maxChars) {
        return ApiErrors.validationFailed([
          { field: `casts.${i}.content`, message: `Content exceeds ${maxChars} characters` },
        ])
      }

      if (cast.embeds && cast.embeds.length > maxEmbeds) {
        return ApiErrors.validationFailed([
          {
            field: `casts.${i}.embeds`,
            message: `Maximum ${maxEmbeds} embeds allowed${account.isPremium ? '' : ' (upgrade to Pro for 4)'}`,
          },
        ])
      }
    }
    
    const scheduleThreadFn = async () => {
      const threadId = generateId()

      await db.transaction(async (tx) => {
        await tx.insert(threads).values({
          id: threadId,
          accountId,
          title: casts[0]?.content?.substring(0, 50) || null,
          status: 'scheduled',
          scheduledAt: scheduledDate,
        })

        for (let i = 0; i < casts.length; i++) {
          const cast = casts[i]
          const castId = generateId()

          await tx.insert(scheduledCasts).values({
            id: castId,
            accountId,
            content: cast.content.trim(),
            scheduledAt: scheduledDate,
            channelId: channelId || null,
            network: 'farcaster',
            publishTargets: JSON.stringify(['farcaster']),
            status: 'scheduled',
            threadId,
            threadOrder: i,
            createdById: session.userId,
          })

          const embeds = cast.embeds || []
          if (embeds.length === 0) continue

          const mediaEmbeds = embeds.filter((embed) => {
            const url = embed.url || ''
            const isCloudflare = Boolean(embed.cloudflareId) || url.includes('cloudflare') || url.includes('imagedelivery.net')
            const isLivepeer = Boolean(embed.livepeerAssetId) || url.includes('livepeer') || url.includes('lp-playback')
            const hasMediaExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m3u8)$/i.test(url)
            const isExplicitVideo = embed.type === 'video'
            return isCloudflare || isLivepeer || hasMediaExtension || isExplicitVideo
          })

          if (mediaEmbeds.length === 0) continue

          await tx.insert(castMedia).values(
            mediaEmbeds.map((embed, index) => {
              const url = embed.url
              const isVideo =
                embed.type === 'video' ||
                /\.(mp4|mov|webm|m3u8)$/i.test(url) ||
                url.includes('cloudflarestream.com') ||
                url.includes('lp-playback')

              const record: {
                id: string
                castId: string
                url: string
                type: 'image' | 'video'
                order: number
                cloudflareId?: string
                livepeerAssetId?: string
                livepeerPlaybackId?: string
                videoStatus?: 'pending' | 'processing' | 'ready' | 'error'
              } = {
                id: generateId(),
                castId,
                url,
                type: isVideo ? 'video' : 'image',
                order: index,
              }

              if (embed.cloudflareId) record.cloudflareId = embed.cloudflareId
              if (embed.livepeerAssetId) record.livepeerAssetId = embed.livepeerAssetId
              if (embed.livepeerPlaybackId) record.livepeerPlaybackId = embed.livepeerPlaybackId
              if (embed.videoStatus) record.videoStatus = embed.videoStatus

              return record
            })
          )
        }
      })

      const payload = { threadId, castsCount: casts.length }

      if (idemKey) {
        try {
          await setIdempotencyResponse(idemKey, { status: 201, data: payload }, 60 * 60 * 24)
        } catch (error) {
          console.warn('[ScheduleThread] Failed to store idempotency response:', error)
        }
      }

      return success(payload, 201)
    }

    if (!idemKey) {
      return await scheduleThreadFn()
    }

    const locked = await withLock(idemKey, async () => {
      const cached = await getIdempotencyResponse(idemKey)
      if (cached) {
        return { type: 'replay' as const, cached }
      }

      const response = await scheduleThreadFn()
      return { type: 'fresh' as const, response }
    }, { ttlSeconds: 30 })

    if (!locked.success) {
      return ApiErrors.alreadyExists('Schedule thread already in progress')
    }

    if (locked.result.type === 'replay') {
      return success(locked.result.cached.data, locked.result.cached.status)
    }

    return locked.result.response
  } catch (error) {
    console.error('[API] Error scheduling thread:', error)
    return ApiErrors.operationFailed('Failed to schedule thread')
  }
}
