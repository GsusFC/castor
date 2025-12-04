import { NextRequest } from 'next/server'
import { db, scheduledCasts, castMedia } from '@/lib/db'
import { getSession, canAccess } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, updateCastSchema } from '@/lib/validations'

// Helper to get cast with permission check
async function getCastWithAuth(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const cast = await db.query.scheduledCasts.findFirst({
    where: eq(scheduledCasts.id, id),
    with: {
      account: true,
      media: true,
    },
  })

  if (!cast) {
    return { error: ApiErrors.notFound('Cast') }
  }

  if (!cast.account) {
    return { error: ApiErrors.notFound('Account') }
  }

  const hasAccess = canAccess(session, {
    ownerId: cast.account.ownerId,
    isShared: cast.account.isShared,
    createdById: cast.createdById,
  })

  if (!hasAccess) {
    return { error: ApiErrors.forbidden('No access to this cast') }
  }

  return { cast }
}

/**
 * GET /api/casts/[id]
 * Obtiene un cast programado por ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params
    const result = await getCastWithAuth(id, session)

    if ('error' in result) {
      return result.error
    }

    return success({ cast: result.cast })
  } catch (error) {
    console.error('[GET Cast] Error:', error instanceof Error ? error.message : 'Unknown')
    return ApiErrors.operationFailed('Failed to get cast')
  }
}

/**
 * DELETE /api/casts/[id]
 * Cancela/elimina un cast programado
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params
    const result = await getCastWithAuth(id, session)

    if ('error' in result) {
      return result.error
    }

    const { cast } = result

    // Cannot delete published casts
    if (cast.status === 'published') {
      return ApiErrors.validationFailed([{ 
        field: 'status', 
        message: 'Cannot delete a published cast' 
      }])
    }

    // Delete media first, then cast
    await db.delete(castMedia).where(eq(castMedia.castId, id))
    await db.delete(scheduledCasts).where(eq(scheduledCasts.id, id))

    console.log('[Delete] Cast deleted:', id)
    return success({ deleted: true })
  } catch (error) {
    console.error('[Delete] Error:', error instanceof Error ? error.message : 'Unknown')
    return ApiErrors.operationFailed('Failed to delete cast')
  }
}

/**
 * PATCH /api/casts/[id]
 * Actualiza un cast programado
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params
    const body = await req.json()

    // Validate input
    const validation = validate(updateCastSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const result = await getCastWithAuth(id, session)
    if ('error' in result) {
      return result.error
    }

    const { cast } = result
    const { content, scheduledAt, channelId, accountId, embeds } = validation.data

    // Can only edit draft, scheduled, or failed casts
    const editableStatuses = ['draft', 'scheduled', 'failed', 'retrying']
    if (!editableStatuses.includes(cast.status)) {
      return ApiErrors.validationFailed([{ 
        field: 'status', 
        message: `Cannot edit cast with status: ${cast.status}` 
      }])
    }

    // Update cast in transaction
    await db.transaction(async (tx) => {
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (content !== undefined) updates.content = content
      if (scheduledAt) updates.scheduledAt = new Date(scheduledAt)
      if (channelId !== undefined) updates.channelId = channelId
      if (accountId !== undefined) updates.accountId = accountId
      
      // If editing a failed/retrying cast, reset to scheduled
      if (cast.status === 'failed' || cast.status === 'retrying') {
        updates.status = 'scheduled'
        updates.errorMessage = null
        updates.retryCount = 0
      }

      await tx
        .update(scheduledCasts)
        .set(updates)
        .where(eq(scheduledCasts.id, id))

      // Update media if provided
      if (embeds !== undefined) {
        await tx.delete(castMedia).where(eq(castMedia.castId, id))

        if (Array.isArray(embeds) && embeds.length > 0) {
          await tx.insert(castMedia).values(
            embeds.map((embed, index) => ({
              id: generateId(),
              castId: id,
              url: embed.url,
              type: embed.type || 'image' as const,
              order: index,
            }))
          )
        }
      }
    })

    console.log('[PATCH Cast] Updated:', id)
    return success({ updated: true })
  } catch (error) {
    console.error('[PATCH Cast] Error:', error instanceof Error ? error.message : 'Unknown')
    return ApiErrors.operationFailed('Failed to update cast')
  }
}
