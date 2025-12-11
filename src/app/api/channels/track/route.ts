import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, userChannels } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// POST - Trackear uso de un canal (llamar al publicar)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId, channelName, channelImageUrl } = await request.json()

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
      // Incrementar contador
      await db.update(userChannels)
        .set({
          useCount: sql`${userChannels.useCount} + 1`,
          lastUsedAt: new Date(),
          channelName,
          channelImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(userChannels.id, existing.id))
    } else {
      // Crear nuevo con uso inicial
      await db.insert(userChannels).values({
        id: nanoid(),
        userId: session.userId,
        channelId,
        channelName,
        channelImageUrl,
        isFavorite: false,
        useCount: 1,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error tracking channel:', error)
    return NextResponse.json({ error: 'Failed to track channel' }, { status: 500 })
  }
}
