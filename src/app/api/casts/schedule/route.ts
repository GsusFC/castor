import { NextRequest } from 'next/server'
import { db, scheduledCasts, accounts, castMedia, accountMembers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getSession, canAccess } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, scheduleCastSchema } from '@/lib/validations'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { calculateTextLength } from '@/lib/url-utils'
import { withLock } from '@/lib/lock'
import { getIdempotencyResponse, setIdempotencyResponse } from '@/lib/idempotency'
import { fetchWithTimeout } from '@/lib/fetch'
import { env } from '@/lib/env'

const CF_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = env.CLOUDFLARE_IMAGES_API_KEY
const CF_STREAM_DOMAIN = env.CLOUDFLARE_STREAM_DOMAIN

type CloudflareVideoRef = {
  mediaId: string
  cloudflareId: string
}

type CastMediaUpdate = Partial<typeof castMedia.$inferInsert>

const bestEffortNormalizeCloudflareVideos = async (videos: CloudflareVideoRef[]) => {
  if (videos.length === 0) return
  if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) return

  await Promise.all(
    videos.map(async ({ mediaId, cloudflareId }) => {
      try {
        const cfResponse = await fetchWithTimeout(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${cloudflareId}`,
          {
            headers: {
              Authorization: `Bearer ${CF_IMAGES_TOKEN}`,
            },
            timeoutMs: 3_000,
          }
        )

        if (!cfResponse.ok) {
          return
        }

        const cfData = (await cfResponse.json().catch(() => null)) as any
        if (!cfData?.success || !cfData?.result) {
          return
        }

        const isReady = Boolean(cfData.result.readyToStream)
        const width = typeof cfData.result?.input?.width === 'number' ? (cfData.result.input.width as number) : null
        const height = typeof cfData.result?.input?.height === 'number' ? (cfData.result.input.height as number) : null

        const updateData: CastMediaUpdate = {
          videoStatus: isReady ? 'ready' : 'pending',
        }

        if (typeof width === 'number') updateData.width = width
        if (typeof height === 'number') updateData.height = height

        if (isReady) {
          const baseUrl = `https://${CF_STREAM_DOMAIN}/${cloudflareId}`
          const hlsUrl = `${baseUrl}/manifest/video.m3u8`
          const thumbnailUrl = `${baseUrl}/thumbnails/thumbnail.jpg`

          updateData.hlsUrl = hlsUrl
          updateData.thumbnailUrl = thumbnailUrl
          updateData.mp4Url = `${baseUrl}/downloads/default.mp4`
          updateData.url = hlsUrl
        }

        await db.update(castMedia).set(updateData).where(eq(castMedia.id, mediaId))
      } catch (error) {
        console.warn('[Schedule] Cloudflare best-effort normalize failed:', error)
      }
    })
  )
}

/**
 * POST /api/casts/schedule
 * Programa un nuevo cast
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const body = await request.json()
    
    console.log('[Schedule API] Received body:', JSON.stringify(body, null, 2))

    // Validar input con Zod
    const validation = validate(scheduleCastSchema, body)
    if (!validation.success) {
      // Log detallado del error de validación
      const errorResponse = validation.error as Response
      const errorClone = errorResponse.clone()
      const errorBody = await errorClone.json().catch(() => null)
      console.log('[Schedule API] Validation failed - details:', JSON.stringify(errorBody, null, 2))
      return validation.error
    }

    const { accountId, content, scheduledAt, channelId, embeds, isDraft, parentHash, idempotencyKey } = validation.data

    const idemKey = idempotencyKey
      ? `schedule:${session.userId}:${accountId}:${idempotencyKey}`
      : null

    if (idemKey) {
      const cached = await getIdempotencyResponse(idemKey)
      if (cached) {
        return success(cached.data, cached.status)
      }
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(`schedule:${session.userId}`, 'api')
    if (!rateLimit.success) {
      console.warn('[Schedule] Rate limit exceeded:', session.userId, ip)
      return ApiErrors.rateLimited()
    }
    
    console.log('[Schedule API] Parsed embeds:', embeds)

    // Verificar cuenta
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

    // Verificar permisos
    if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return ApiErrors.forbidden('No access to this account')
    }

    // Verificar signer aprobado
    if (account.signerStatus !== 'approved') {
      return ApiErrors.validationFailed([{ 
        field: 'accountId', 
        message: 'Account signer is not approved' 
      }])
    }

    // Validar longitud de contenido usando calculateTextLength (considera URLs)
    // Farcaster: Standard 1024 chars, Pro 10000 chars
    const maxChars = account.isPremium ? 10000 : 1024
    if (content && calculateTextLength(content) > maxChars) {
      return ApiErrors.validationFailed([{ 
        field: 'content', 
        message: `Content exceeds ${maxChars} characters` 
      }])
    }

    // Validar número de embeds
    // Farcaster: Standard 2 embeds, Pro 4 embeds
    const maxEmbeds = account.isPremium ? 4 : 2
    if (embeds && embeds.length > maxEmbeds) {
      return ApiErrors.validationFailed([{ 
        field: 'embeds', 
        message: `Maximum ${maxEmbeds} embeds allowed${account.isPremium ? '' : ' (upgrade to Pro for 4)'}` 
      }])
    }

    // Validar fecha futura para casts programados
    let scheduledDate: Date | null = null
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt)
      if (Number.isNaN(scheduledDate.getTime())) {
        return ApiErrors.validationFailed([
          { field: 'scheduledAt', message: 'Invalid scheduledAt' },
        ])
      }
      if (!isDraft && scheduledDate <= new Date()) {
        return ApiErrors.validationFailed([{ 
          field: 'scheduledAt', 
          message: 'Scheduled time must be in the future' 
        }])
      }
    }

    // Crear el cast en transacción
    const scheduleFn = async () => {
      const castId = generateId()

      let cloudflareVideosToNormalize: CloudflareVideoRef[] = []

      await db.transaction(async (tx) => {
        // Insertar cast
        await tx.insert(scheduledCasts).values({
          id: castId,
          accountId,
          content: (content || '').trim(),
          scheduledAt: scheduledDate || new Date(),
          channelId: channelId || null,
          network: 'farcaster',
          publishTargets: JSON.stringify(['farcaster']),
          parentHash: parentHash || null,
          status: isDraft ? 'draft' as const : 'scheduled' as const,
          createdById: session.userId,
        })

        // Insertar media si hay embeds
        // Solo guardar embeds que sean media real (imágenes/videos subidos), no links
        if (embeds && embeds.length > 0) {
          const mediaEmbeds = embeds.filter(embed => {
            // Es media real si:
            // 1. Tiene cloudflareId (subido a Cloudflare)
            // 2. Tiene livepeerAssetId (subido a Livepeer)
            // 3. Es una URL de Cloudflare o Livepeer
            // 4. Tiene extensión de imagen/video
            // 5. Tiene type explícito de video
            const url = embed.url || ''
            const isCloudflare = embed.cloudflareId || 
              url.includes('cloudflare') || 
              url.includes('imagedelivery.net')
            const isLivepeer = embed.livepeerAssetId ||
              url.includes('livepeer') ||
              url.includes('lp-playback')
            const hasMediaExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m3u8)$/i.test(url)
            const isExplicitVideo = embed.type === 'video'
            return Boolean(isCloudflare || isLivepeer || hasMediaExtension || isExplicitVideo)
          })
          
          if (mediaEmbeds.length > 0) {
            const mediaValues = mediaEmbeds.map((embed, index) => {
              // Determinar tipo: usar el proporcionado o inferir de la URL
              const isVideo = embed.type === 'video' || 
                embed.url.match(/\.(mp4|mov|webm|m3u8)$/i) ||
                embed.url.includes('cloudflarestream.com') ||
                embed.url.includes('lp-playback')
              
              const mediaRecord: {
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
                url: embed.url,
                type: isVideo ? 'video' : 'image',
                order: index,
              }
              
              // Solo añadir campos de video si tienen valor
              if (embed.cloudflareId) {
                mediaRecord.cloudflareId = embed.cloudflareId
              }
              if (embed.livepeerAssetId) {
                mediaRecord.livepeerAssetId = embed.livepeerAssetId
              }
              if (embed.livepeerPlaybackId) {
                mediaRecord.livepeerPlaybackId = embed.livepeerPlaybackId
              }

              const shouldDefaultPending = isVideo && Boolean(embed.cloudflareId || embed.livepeerAssetId)
              const resolvedVideoStatus = embed.videoStatus ?? (shouldDefaultPending ? 'pending' : undefined)
              if (resolvedVideoStatus) {
                mediaRecord.videoStatus = resolvedVideoStatus
              }
              
              return mediaRecord
            })

            cloudflareVideosToNormalize = mediaValues
              .filter((m) => m.type === 'video' && typeof m.cloudflareId === 'string' && m.cloudflareId.length > 0 && !m.livepeerAssetId)
              .map((m) => ({ mediaId: m.id, cloudflareId: m.cloudflareId! }))

            await tx.insert(castMedia).values(mediaValues)
          }
        }
      })

      await bestEffortNormalizeCloudflareVideos(cloudflareVideosToNormalize)

      console.log('[Schedule] Cast created:', castId)

      const payload = {
        castId,
        status: isDraft ? 'draft' : 'scheduled',
        scheduledAt: scheduledDate?.toISOString(),
      }

      if (idemKey) {
        try {
          await setIdempotencyResponse(idemKey, { status: 201, data: payload }, 60 * 60 * 24)
        } catch (error) {
          console.warn('[Schedule] Failed to store idempotency response:', error)
        }
      }

      return success(payload, 201)
    }

    if (!idemKey) {
      return await scheduleFn()
    }

    const locked = await withLock(idemKey, async () => {
      const cached = await getIdempotencyResponse(idemKey)
      if (cached) {
        return { type: 'replay' as const, cached }
      }

      const response = await scheduleFn()
      return { type: 'fresh' as const, response }
    }, { ttlSeconds: 30 })

    if (!locked.success) {
      return ApiErrors.alreadyExists('Schedule already in progress')
    }

    if (locked.result.type === 'replay') {
      return success(locked.result.cached.data, locked.result.cached.status)
    }

    return locked.result.response

  } catch (error) {
    console.error('[Schedule] Error:', error instanceof Error ? error.message : 'Unknown')
    return ApiErrors.operationFailed('Failed to schedule cast')
  }
}
