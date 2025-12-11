import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, userChannels } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// GET - Obtener favoritos y recientes del usuario
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channels = await db.query.userChannels.findMany({
      where: eq(userChannels.userId, session.userId),
      orderBy: [desc(userChannels.isFavorite), desc(userChannels.lastUsedAt)],
    })

    const favorites = channels.filter(c => c.isFavorite)
    const recent = channels
      .filter(c => !c.isFavorite && c.useCount > 0)
      .slice(0, 5)

    return NextResponse.json({ favorites, recent })
  } catch (error) {
    console.error('[API] Error fetching user channels:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

// POST - Marcar/desmarcar favorito
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId, channelName, channelImageUrl, isFavorite } = await request.json()

    if (!channelId || !channelName) {
      return NextResponse.json({ error: 'channelId and channelName required' }, { status: 400 })
    }

    // Buscar si ya existe
    const existing = await db.query.userChannels.findFirst({
      where: and(
        eq(userChannels.userId, session.userId),
        eq(userChannels.channelId, channelId)
      ),
    })

    if (existing) {
      // Actualizar
      await db.update(userChannels)
        .set({
          isFavorite: Boolean(isFavorite),
          channelName,
          channelImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(userChannels.id, existing.id))
    } else {
      // Crear nuevo
      await db.insert(userChannels).values({
        id: nanoid(),
        userId: session.userId,
        channelId,
        channelName,
        channelImageUrl,
        isFavorite: Boolean(isFavorite),
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    return NextResponse.json({ success: true, isFavorite })
  } catch (error) {
    console.error('[API] Error updating favorite:', error)
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 })
  }
}
