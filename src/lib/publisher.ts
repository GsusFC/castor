import { db, scheduledCasts, castMedia } from '@/lib/db'
import { eq, lte, and, asc, or } from 'drizzle-orm'
import { publishCast } from '@/lib/farcaster'
import { publisherLogger, createTimer } from '@/lib/logger'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

// ============================================
// Configuration
// ============================================

const MAX_RETRY_COUNT = 3
const RETRY_DELAY_MINUTES = [5, 15, 60] // Backoff: 5min, 15min, 1hr
// Dominio personalizado para videos (requerido por Farcaster)
const CF_STREAM_DOMAIN = process.env.CLOUDFLARE_STREAM_DOMAIN || 'video.castorapp.xyz'

/**
 * Determines if a failed cast should be retried
 */
function shouldRetry(retryCount: number, errorMessage: string | null): boolean {
  if (retryCount >= MAX_RETRY_COUNT) return false
  
  // Don't retry on permanent errors
  const permanentErrors = [
    'invalid signer',
    'signer not approved',
    'account not found',
    'content too long',
    'invalid channel',
  ]
  
  if (errorMessage) {
    const lowerError = errorMessage.toLowerCase()
    if (permanentErrors.some(e => lowerError.includes(e))) {
      return false
    }
  }
  
  return true
}

/**
 * Calculates next retry time based on retry count
 */
function getNextRetryTime(retryCount: number): Date {
  const delayMinutes = RETRY_DELAY_MINUTES[retryCount] || RETRY_DELAY_MINUTES[RETRY_DELAY_MINUTES.length - 1]
  return new Date(Date.now() + delayMinutes * 60 * 1000)
}

// ============================================
// Publisher
// ============================================

interface PublishResult {
  published: number
  failed: number
  retrying: number
  skipped: number
}

/**
 * Publica todos los casts que ya deberían haberse publicado
 */
export async function publishDueCasts(): Promise<PublishResult> {
  const timer = createTimer()
  const now = new Date()
  
  const result: PublishResult = {
    published: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
  }
  
  publisherLogger.info({ timestamp: now.toISOString() }, 'Starting publish cycle')

  // Buscar casts pendientes cuya hora ya pasó
  // Incluir casts en estado 'retrying' cuya hora de reintento ya pasó
  const dueCasts = await db.query.scheduledCasts.findMany({
    where: and(
      or(
        eq(scheduledCasts.status, 'scheduled'),
        eq(scheduledCasts.status, 'retrying')
      ),
      lte(scheduledCasts.scheduledAt, now)
    ),
    with: {
      account: true,
    },
    orderBy: [asc(scheduledCasts.threadId), asc(scheduledCasts.threadOrder)],
  })

  // Cargar media por separado para cada cast
  for (const cast of dueCasts) {
    const media = await db.query.castMedia.findMany({
      where: eq(castMedia.castId, cast.id),
    })
    ;(cast as typeof cast & { media: typeof media }).media = media
  }

  publisherLogger.info({ count: dueCasts.length }, 'Found due casts')
  
  // Agrupar por threadId para publicar threads en orden
  const threadHashes: Record<string, string> = {}
  const failedThreads = new Set<string>() // Track failed threads to skip subsequent casts

  for (const cast of dueCasts) {
    // Skip if part of a failed thread
    if (cast.threadId && failedThreads.has(cast.threadId)) {
      publisherLogger.warn({ castId: cast.id, threadId: cast.threadId }, 'Skipping cast due to failed thread')
      result.skipped++
      continue
    }

    if (!cast.account) {
      publisherLogger.error({ castId: cast.id }, 'Cast has no account')
      await markAsFailed(cast.id, 'Account not found', cast.retryCount)
      result.failed++
      continue
    }

    if (cast.account.signerStatus !== 'approved') {
      publisherLogger.error({ accountId: cast.account.id }, 'Account signer not approved')
      await markAsFailed(cast.id, 'Signer not approved', cast.retryCount)
      result.failed++
      continue
    }

    try {
      // Verificar que todos los videos estén listos antes de publicar
      const castWithMedia = cast as typeof cast & { 
        media?: { 
          url: string
          type: string
          videoStatus?: string | null
          mp4Url?: string | null
          hlsUrl?: string | null
          cloudflareId?: string | null
          livepeerAssetId?: string | null
          livepeerPlaybackId?: string | null
        }[] 
      }
      
      // Verificar videos de Livepeer pendientes
      const livepeerVideos = castWithMedia.media?.filter(
        m => m.type === 'video' && m.livepeerAssetId && m.videoStatus !== 'ready'
      ) || []
      
      for (const video of livepeerVideos) {
        try {
          const lpResponse = await fetch(
            `https://livepeer.studio/api/asset/${video.livepeerAssetId}`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.LIVEPEER_API_KEY}`,
              },
            }
          )
          
          if (lpResponse.ok) {
            const asset = await lpResponse.json()
            const status = asset.status?.phase
            
            if (status === 'ready') {
              // Usar playbackUrl de Livepeer (HLS completo) - Warpcast lo prefiere
              const hlsUrl = asset.playbackUrl || null
              const mp4Url = asset.downloadUrl || null
              
              await db.update(castMedia).set({
                videoStatus: 'ready',
                hlsUrl: hlsUrl || undefined,
                mp4Url: mp4Url || undefined,
                url: hlsUrl || mp4Url || video.url,
              }).where(eq(castMedia.livepeerAssetId, video.livepeerAssetId!))
              
              video.videoStatus = 'ready'
              video.hlsUrl = hlsUrl
              video.mp4Url = mp4Url
              video.url = hlsUrl || mp4Url || video.url
              
              publisherLogger.info({ livepeerAssetId: video.livepeerAssetId, hlsUrl, mp4Url }, 'Livepeer video ready')
            }
          }
        } catch (error) {
          publisherLogger.warn({ livepeerAssetId: video.livepeerAssetId, error }, 'Failed to check Livepeer video status')
        }
      }
      
      // Verificar videos de Cloudflare pendientes
      const cloudflareVideos = castWithMedia.media?.filter(
        m => m.type === 'video' && m.cloudflareId && !m.livepeerAssetId && m.videoStatus !== 'ready'
      ) || []
      
      for (const video of cloudflareVideos) {
        try {
          const cfResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/${video.cloudflareId}`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.CLOUDFLARE_IMAGES_API_KEY}`,
              },
            }
          )
          
          if (cfResponse.ok) {
            const cfData = await cfResponse.json()
            if (cfData.result?.readyToStream) {
              // Construir URLs con dominio personalizado (requerido por Farcaster)
              const baseUrl = `https://${CF_STREAM_DOMAIN}/${video.cloudflareId}`
              const hlsUrl = `${baseUrl}/manifest/video.m3u8`
              const thumbnailUrl = `${baseUrl}/thumbnails/thumbnail.jpg`
              
              let mp4Url: string | null = null
              try {
                const downloadRes = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/${video.cloudflareId}/downloads`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.CLOUDFLARE_IMAGES_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}),
                  }
                )
                if (downloadRes.ok) {
                  const downloadData = await downloadRes.json()
                  mp4Url = downloadData.result?.default?.url
                }
              } catch (err) {
                publisherLogger.warn({ cloudflareId: video.cloudflareId }, 'Could not enable MP4 downloads')
              }
              
              await db.update(castMedia).set({
                videoStatus: 'ready',
                hlsUrl,
                thumbnailUrl,
                mp4Url: mp4Url || undefined,
                url: hlsUrl, // Priorizar HLS para Farcaster
              }).where(eq(castMedia.cloudflareId, video.cloudflareId!))
              
              video.videoStatus = 'ready'
              video.hlsUrl = hlsUrl
              video.mp4Url = mp4Url
              video.url = hlsUrl
              
              publisherLogger.info({ cloudflareId: video.cloudflareId, hlsUrl, mp4Url }, 'Cloudflare video ready')
            }
          }
        } catch (error) {
          publisherLogger.warn({ cloudflareId: video.cloudflareId, error }, 'Failed to check Cloudflare video status')
        }
      }
      
      // Re-verificar si hay videos pendientes después de la actualización
      const pendingVideos = castWithMedia.media?.filter(
        m => m.type === 'video' && m.videoStatus && m.videoStatus !== 'ready'
      ) || []
      
      if (pendingVideos.length > 0) {
        publisherLogger.warn({ 
          castId: cast.id, 
          pendingVideos: pendingVideos.map(v => ({ 
            cloudflareId: v.cloudflareId, 
            livepeerAssetId: v.livepeerAssetId,
            status: v.videoStatus 
          }))
        }, 'Cast has pending videos, skipping for now')
        result.skipped++
        continue
      }

      // Marcar como publishing
      await db
        .update(scheduledCasts)
        .set({ status: 'publishing', updatedAt: new Date() })
        .where(eq(scheduledCasts.id, cast.id))

      publisherLogger.debug({ castId: cast.id, attempt: cast.retryCount + 1 }, 'Publishing cast')

      // Preparar embeds de media
      // Para videos de Livepeer: usar HLS URL directamente (Warpcast lo soporta bien)
      // Para videos: Warpcast prefiere HLS (.m3u8) sobre MP4
      const embeds = castWithMedia.media?.map(m => {
        if (m.type === 'video') {
          // Livepeer videos: usar HLS (playbackUrl) para Warpcast
          if (m.livepeerAssetId || m.livepeerPlaybackId) {
            // Prioridad: HLS > MP4 > url original
            const videoUrl = m.hlsUrl || m.mp4Url || m.url
            publisherLogger.debug({ 
              livepeerAssetId: m.livepeerAssetId,
              hlsUrl: m.hlsUrl,
              mp4Url: m.mp4Url,
              selectedUrl: videoUrl 
            }, 'Livepeer video URL selection')
            return { url: videoUrl }
          }
          
          // Cloudflare videos: preferir HLS
          const videoUrl = m.hlsUrl || m.mp4Url || m.url
          publisherLogger.debug({ 
            cloudflareId: m.cloudflareId,
            mediaUrl: m.url, 
            hlsUrl: m.hlsUrl, 
            mp4Url: m.mp4Url,
            selectedUrl: videoUrl 
          }, 'Cloudflare video URL selection')
          return { url: videoUrl }
        }
        return { url: m.url }
      }) || []

      // Determinar parentHash para threads
      let parentHash = cast.parentHash || undefined
      if (cast.threadId && cast.threadOrder && cast.threadOrder > 0) {
        parentHash = threadHashes[cast.threadId]
        
        // If we don't have the parent hash, we can't continue the thread
        if (!parentHash) {
          publisherLogger.error({ castId: cast.id, threadId: cast.threadId }, 'Missing parent hash for thread')
          await markAsFailed(cast.id, 'Missing parent hash', cast.retryCount)
          failedThreads.add(cast.threadId)
          result.failed++
          continue
        }
      }

      // Publicar con circuit breaker y reintentos
      const publishResult = await withCircuitBreaker(
        `neynar:${cast.account.id}`,
        () => retryExternalApi(
          () => publishCast(
            cast.account!.signerUuid,
            cast.content,
            {
              embeds: embeds.length > 0 ? embeds : undefined,
              channelId: cast.channelId || undefined,
              parentHash,
            }
          ),
          'publishCast'
        ),
        { failureThreshold: 5, resetTimeoutMs: 60000 }
      )

      if (publishResult.success) {
        // Marcar como publicado
        await db
          .update(scheduledCasts)
          .set({
            status: 'published',
            castHash: publishResult.hash,
            publishedAt: new Date(),
            updatedAt: new Date(),
            errorMessage: null,
          })
          .where(eq(scheduledCasts.id, cast.id))

        publisherLogger.info({ 
          castId: cast.id, 
          hash: publishResult.hash,
          attempts: cast.retryCount + 1,
        }, 'Cast published successfully')
        
        // Guardar hash para el siguiente cast del thread
        if (cast.threadId && publishResult.hash) {
          threadHashes[cast.threadId] = publishResult.hash
        }
        
        result.published++
      } else {
        await handlePublishFailure(cast, publishResult.error || 'Unknown error', failedThreads)
        
        if (shouldRetry(cast.retryCount, publishResult.error || null)) {
          result.retrying++
        } else {
          result.failed++
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      publisherLogger.error({ 
        castId: cast.id, 
        error: errorMessage,
        attempt: cast.retryCount + 1,
      }, 'Cast publish error')
      
      await handlePublishFailure(cast, errorMessage, failedThreads)
      
      if (shouldRetry(cast.retryCount, errorMessage)) {
        result.retrying++
      } else {
        result.failed++
      }
    }
  }

  publisherLogger.info({ 
    ...result,
    duration: timer.elapsed() 
  }, 'Publish cycle completed')

  return result
}

/**
 * Handles a failed publish attempt
 */
async function handlePublishFailure(
  cast: { id: string; retryCount: number; threadId: string | null },
  errorMessage: string,
  failedThreads: Set<string>
): Promise<void> {
  const newRetryCount = cast.retryCount + 1
  const canRetry = shouldRetry(cast.retryCount, errorMessage)

  if (canRetry) {
    // Schedule for retry
    const nextRetryTime = getNextRetryTime(cast.retryCount)
    
    await db
      .update(scheduledCasts)
      .set({
        status: 'retrying',
        errorMessage,
        retryCount: newRetryCount,
        scheduledAt: nextRetryTime,
        updatedAt: new Date(),
      })
      .where(eq(scheduledCasts.id, cast.id))

    publisherLogger.warn({ 
      castId: cast.id, 
      retryCount: newRetryCount,
      nextRetry: nextRetryTime.toISOString(),
      error: errorMessage,
    }, 'Cast scheduled for retry')
  } else {
    // Mark as permanently failed
    await markAsFailed(cast.id, errorMessage, newRetryCount)
    
    // Mark thread as failed if applicable
    if (cast.threadId) {
      failedThreads.add(cast.threadId)
    }
  }
}

/**
 * Marks a cast as permanently failed
 */
async function markAsFailed(
  castId: string, 
  errorMessage: string, 
  retryCount: number
): Promise<void> {
  await db
    .update(scheduledCasts)
    .set({
      status: 'failed',
      errorMessage,
      retryCount,
      updatedAt: new Date(),
    })
    .where(eq(scheduledCasts.id, castId))

  publisherLogger.error({ castId, error: errorMessage, retryCount }, 'Cast permanently failed')
}

/**
 * Retries all failed casts that are eligible for retry
 * Call this manually or from admin panel
 */
export async function retryFailedCasts(): Promise<{ queued: number }> {
  const failedCasts = await db.query.scheduledCasts.findMany({
    where: and(
      eq(scheduledCasts.status, 'failed'),
      lte(scheduledCasts.retryCount, MAX_RETRY_COUNT)
    ),
  })

  let queued = 0
  
  for (const cast of failedCasts) {
    if (shouldRetry(cast.retryCount - 1, cast.errorMessage)) {
      await db
        .update(scheduledCasts)
        .set({
          status: 'retrying',
          scheduledAt: new Date(), // Retry immediately
          updatedAt: new Date(),
        })
        .where(eq(scheduledCasts.id, cast.id))
      
      queued++
    }
  }

  publisherLogger.info({ queued }, 'Failed casts queued for retry')
  return { queued }
}
