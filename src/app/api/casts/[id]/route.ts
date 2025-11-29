import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts } from '@/lib/db'
import { eq } from 'drizzle-orm'

/**
 * DELETE /api/casts/[id]
 * Cancela/elimina un cast programado
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
    })

    if (!cast) {
      return NextResponse.json(
        { error: 'Cast not found' },
        { status: 404 }
      )
    }

    if (cast.status === 'published') {
      return NextResponse.json(
        { error: 'Cannot delete a published cast' },
        { status: 400 }
      )
    }

    await db.delete(scheduledCasts).where(eq(scheduledCasts.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting cast:', error)
    return NextResponse.json(
      { error: 'Failed to delete cast' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/casts/[id]
 * Actualiza un cast programado
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, scheduledAt, channelId } = body

    const cast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
    })

    if (!cast) {
      return NextResponse.json(
        { error: 'Cast not found' },
        { status: 404 }
      )
    }

    if (cast.status !== 'scheduled' && cast.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only edit pending casts' },
        { status: 400 }
      )
    }

    const updates: Partial<typeof cast> = {
      updatedAt: new Date(),
    }

    if (content !== undefined) {
      if (content.length > 320) {
        return NextResponse.json(
          { error: 'content exceeds 320 characters' },
          { status: 400 }
        )
      }
      updates.content = content.trim()
    }

    if (scheduledAt !== undefined) {
      const scheduledDate = new Date(scheduledAt)
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'scheduledAt must be in the future' },
          { status: 400 }
        )
      }
      updates.scheduledAt = scheduledDate
    }

    if (channelId !== undefined) {
      updates.channelId = channelId || null
    }

    await db
      .update(scheduledCasts)
      .set(updates)
      .where(eq(scheduledCasts.id, id))

    const updatedCast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
    })

    return NextResponse.json({ success: true, cast: updatedCast })
  } catch (error) {
    console.error('[API] Error updating cast:', error)
    return NextResponse.json(
      { error: 'Failed to update cast' },
      { status: 500 }
    )
  }
}
