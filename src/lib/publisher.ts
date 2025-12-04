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
        }[] 
      }
      
      // Verificar videos pendientes y actualizar su estado desde Cloudflare
      const videosToCheck = castWithMedia.media?.filter(
        m => m.type === 'video' && m.cloudflareId && m.videoStatus !== 'ready'
      ) || []
      
      for (const video of videosToCheck) {
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
              // Actualizar DB con las URLs correctas
              const hlsUrl = cfData.result.playback?.hls
              
              // Habilitar y obtener MP4 download
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
                  publisherLogger.info({ cloudflareId: video.cloudflareId, mp4Url }, 'MP4 download enabled')
                }
              } catch (err) {
                publisherLogger.warn({ cloudflareId: video.cloudflareId }, 'Could not enable MP4 downloads')
              }
              
              await db.update(castMedia).set({
                videoStatus: 'ready',
                hlsUrl: hlsUrl || undefined,
                mp4Url: mp4Url || undefined,
              }).where(eq(castMedia.cloudflareId, video.cloudflareId!))
              
              // Actualizar en memoria para este ciclo
              video.videoStatus = 'ready'
              video.hlsUrl = hlsUrl
              video.mp4Url = mp4Url
              
              publisherLogger.info({ cloudflareId: video.cloudflareId, hlsUrl, mp4Url }, 'Video ready, updated from Cloudflare')
            }
          }
        } catch (error) {
          publisherLogger.warn({ cloudflareId: video.cloudflareId, error }, 'Failed to check video status')
        }
      }
      
      // Re-verificar si hay videos pendientes después de la actualización
      const pendingVideos = castWithMedia.media?.filter(
        m => m.type === 'video' && m.videoStatus && m.videoStatus !== 'ready'
      ) || []
      
      if (pendingVideos.length > 0) {
        publisherLogger.warn({ 
          castId: cast.id, 
          pendingVideos: pendingVideos.map(v => ({ id: v.cloudflareId, status: v.videoStatus }))
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

      // Preparar embeds de media - para videos usar MP4 que Warpcast renderiza mejor
      // Prioridad: mp4Url > hlsUrl > url
      // Nota: HLS (.m3u8) requiere thumbnail en ruta específica que Cloudflare no provee
      const embeds = castWithMedia.media?.map(m => {
        if (m.type === 'video') {
          // Warpcast maneja mejor MP4 que HLS de Cloudflare Stream
          const videoUrl = m.mp4Url || m.hlsUrl || m.url
          publisherLogger.debug({ 
            mediaUrl: m.url, 
            hlsUrl: m.hlsUrl, 
            mp4Url: m.mp4Url,
            selectedUrl: videoUrl 
          }, 'Video URL selection')
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
