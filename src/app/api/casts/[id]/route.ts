import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts, castMedia, accounts } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const cast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
      with: {
        account: true,
        media: true,
      },
    })

    if (!cast) {
      return NextResponse.json({ error: 'Cast not found' }, { status: 404 })
    }

    // Verificar permisos
    const isOwner = cast.account.ownerId === session.userId
    const isShared = cast.account.isShared
    const isCreator = cast.createdById === session.userId
    const isAdmin = session.role === 'admin'

    if (!isOwner && !isShared && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ cast })
  } catch (error) {
    console.error('[Casts] Get error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const cast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
      with: {
        account: true,
      },
    })

    if (!cast) {
      return NextResponse.json(
        { error: 'Cast not found' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isOwner = cast.account.ownerId === session.userId
    const isShared = cast.account.isShared
    const isCreator = cast.createdById === session.userId
    const isAdmin = session.role === 'admin'

    if (!isOwner && !isShared && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { content, scheduledAt, channelId, accountId, embeds } = body

    // Verificar que el cast existe y pertenece al usuario (o a una cuenta compartida)
    const cast = await db.query.scheduledCasts.findFirst({
      where: eq(scheduledCasts.id, id),
      with: {
        account: true,
      },
    })

    if (!cast) {
      return NextResponse.json({ error: 'Cast not found' }, { status: 404 })
    }

    // Verificar permisos
    const isOwner = cast.account.ownerId === session.userId
    const isShared = cast.account.isShared
    const isCreator = cast.createdById === session.userId
    const isAdmin = session.role === 'admin'

    if (!isOwner && !isShared && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verificar estado (solo se pueden editar casts no publicados)
    if (cast.status !== 'scheduled' && cast.status !== 'draft') {
      return NextResponse.json({ error: 'Can only edit pending casts' }, { status: 400 })
    }

    // Actualizar cast
    await db.transaction(async (tx) => {
      const updates: any = {
        updatedAt: new Date(),
      }

      if (content !== undefined) updates.content = content
      if (scheduledAt) updates.scheduledAt = new Date(scheduledAt)
      if (channelId !== undefined) updates.channelId = channelId
      if (accountId !== undefined) updates.accountId = accountId

      await tx
        .update(scheduledCasts)
        .set(updates)
        .where(eq(scheduledCasts.id, id))

      // Actualizar medios si se proporcionan
      if (embeds !== undefined) {
        // Borrar medios existentes
        await tx.delete(castMedia).where(eq(castMedia.castId, id))

        // Insertar nuevos medios
        if (Array.isArray(embeds) && embeds.length > 0) {
          await tx.insert(castMedia).values(
            embeds.map((embed: { url: string; type?: 'image' | 'video' }, index: number) => ({
              id: generateId(),
              castId: id,
              url: embed.url,
              type: embed.type || 'image', // Por defecto imagen si no se especifica
              order: index,
            }))
          )
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Casts] Edit error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
