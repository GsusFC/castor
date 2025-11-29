import { db, scheduledCasts, castMedia, accounts } from '@/lib/db'
import { eq, lte, and } from 'drizzle-orm'
import { publishCast } from '@/lib/farcaster'

/**
 * Publica todos los casts que ya deberían haberse publicado
 */
export async function publishDueCasts() {
  const now = new Date()
  
  console.log(`[Publisher] Checking for due casts at ${now.toISOString()}`)

  // Buscar casts pendientes cuya hora ya pasó
  const dueCasts = await db.query.scheduledCasts.findMany({
    where: and(
      eq(scheduledCasts.status, 'scheduled'),
      lte(scheduledCasts.scheduledAt, now)
    ),
    with: {
      account: true,
    },
  })

  // Cargar media por separado para cada cast
  for (const cast of dueCasts) {
    const media = await db.query.castMedia.findMany({
      where: eq(castMedia.castId, cast.id),
    })
    ;(cast as typeof cast & { media: typeof media }).media = media
  }

  console.log(`[Publisher] Found ${dueCasts.length} due casts`)

  for (const cast of dueCasts) {
    if (!cast.account) {
      console.error(`[Publisher] Cast ${cast.id} has no account`)
      continue
    }

    if (cast.account.signerStatus !== 'approved') {
      console.error(`[Publisher] Account ${cast.account.id} signer not approved`)
      continue
    }

    try {
      // Marcar como publishing
      await db
        .update(scheduledCasts)
        .set({ status: 'publishing', updatedAt: new Date() })
        .where(eq(scheduledCasts.id, cast.id))

      console.log(`[Publisher] Publishing cast ${cast.id}...`)

      // Preparar embeds de media
      const castWithMedia = cast as typeof cast & { media?: { url: string }[] }
      const embeds = castWithMedia.media?.map(m => ({ url: m.url })) || []

      // Publicar
      const result = await publishCast(
        cast.account.signerUuid,
        cast.content,
        {
          embeds: embeds.length > 0 ? embeds : undefined,
          channelId: cast.channelId || undefined,
          parentHash: cast.parentHash || undefined,
        }
      )

      if (result.success) {
        // Marcar como publicado
        await db
          .update(scheduledCasts)
          .set({
            status: 'published',
            castHash: result.hash,
            publishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(scheduledCasts.id, cast.id))

        console.log(`[Publisher] ✅ Cast ${cast.id} published: ${result.hash}`)
      } else {
        // Marcar como fallido
        await db
          .update(scheduledCasts)
          .set({
            status: 'failed',
            errorMessage: result.error,
            retryCount: cast.retryCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(scheduledCasts.id, cast.id))

        console.error(`[Publisher] ❌ Cast ${cast.id} failed: ${result.error}`)
      }
    } catch (error) {
      console.error(`[Publisher] Error publishing cast ${cast.id}:`, error)
      
      await db
        .update(scheduledCasts)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: cast.retryCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(scheduledCasts.id, cast.id))
    }
  }

  return { published: dueCasts.length }
}
