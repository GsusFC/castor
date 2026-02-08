import { NextRequest } from 'next/server'
import { db, scheduledCasts, castMedia, accountMembers } from '@/lib/db'
import { getSession, canAccess } from '@/lib/auth'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { success, ApiErrors } from '@/lib/api/response'

/**
 * POST /api/casts/[id]/duplicate
 * Duplica un cast existente como nuevo draft
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params

    // Fetch original cast with account and media
    const cast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
      with: {
        account: {
          columns: { id: true, ownerId: true },
        },
        media: true,
      },
    })

    if (!cast) {
      return ApiErrors.notFound('Cast')
    }

    if (!cast.account) {
      return ApiErrors.notFound('Account')
    }

    // Check access
    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, cast.accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!canAccess(session, { ownerId: cast.account.ownerId, isMember: !!membership })) {
      return ApiErrors.forbidden('No access to this cast')
    }

    // Create duplicate as draft
    const newCastId = generateId()

    await db.transaction(async (tx) => {
      await tx.insert(scheduledCasts).values({
        id: newCastId,
        accountId: cast.accountId,
        content: cast.content,
        channelId: cast.channelId,
        parentHash: cast.parentHash,
        status: 'draft',
        scheduledAt: new Date(),
        createdById: session.userId,
      })

      // Copy media
      if (cast.media && cast.media.length > 0) {
        await tx.insert(castMedia).values(
          cast.media.map((m) => ({
            id: generateId(),
            castId: newCastId,
            url: m.url,
            type: m.type,
            order: m.order,
            cloudflareId: m.cloudflareId,
            livepeerAssetId: m.livepeerAssetId,
            livepeerPlaybackId: m.livepeerPlaybackId,
            videoStatus: m.videoStatus,
            mp4Url: m.mp4Url,
            hlsUrl: m.hlsUrl,
            thumbnailUrl: m.thumbnailUrl,
            width: m.width,
            height: m.height,
          }))
        )
      }
    })

    return success({ castId: newCastId, status: 'draft' }, 201)
  } catch (error) {
    console.error('[Duplicate Cast] Error:', error instanceof Error ? error.message : 'Unknown')
    return ApiErrors.operationFailed('Failed to duplicate cast')
  }
}
