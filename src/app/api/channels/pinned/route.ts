import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, userChannels } from '@/lib/db'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'

const MAX_PINNED_TABS = 3

async function handleGET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channels = await db.query.userChannels.findMany({
      where: and(
        eq(userChannels.userId, session.userId),
        eq(userChannels.isTabPinned, true)
      ),
      orderBy: [asc(userChannels.pinnedOrder), desc(userChannels.updatedAt)],
    })

    const pinned = channels.map((channel) => ({
      id: channel.channelId,
      name: channel.channelName,
      image_url: channel.channelImageUrl || undefined,
    }))

    const res = NextResponse.json({ pinned })
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (error) {
    console.error('[API] Error fetching pinned channels:', error)
    return NextResponse.json({ error: 'Failed to fetch pinned channels' }, { status: 500 })
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)

async function handlePOST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId, channelName, channelImageUrl, isPinned } = await request.json()

    if (!channelId || !channelName) {
      return NextResponse.json({ error: 'channelId and channelName required' }, { status: 400 })
    }

    const existing = await db.query.userChannels.findFirst({
      where: and(
        eq(userChannels.userId, session.userId),
        eq(userChannels.channelId, channelId)
      ),
    })

    const nextPinned = Boolean(isPinned)
    if (nextPinned && !existing?.isTabPinned) {
      const countRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(userChannels)
        .where(
          and(
            eq(userChannels.userId, session.userId),
            eq(userChannels.isTabPinned, true)
          )
        )
      const pinnedCount = countRows[0]?.count ?? 0
      if (pinnedCount >= MAX_PINNED_TABS) {
        return NextResponse.json(
          { error: 'Max pinned channels reached', code: 'MAX_PINNED' },
          { status: 400 }
        )
      }
    }

    if (existing) {
      await db.update(userChannels)
        .set({
          isTabPinned: nextPinned,
          channelName,
          channelImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(userChannels.id, existing.id))
    } else if (nextPinned) {
      await db.insert(userChannels).values({
        id: nanoid(),
        userId: session.userId,
        channelId,
        channelName,
        channelImageUrl,
        isFavorite: false,
        isTabPinned: true,
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    return NextResponse.json({ success: true, isPinned: nextPinned })
  } catch (error) {
    console.error('[API] Error updating pinned channels:', error)
    return NextResponse.json({ error: 'Failed to update pinned channels' }, { status: 500 })
  }
}

export const POST = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handlePOST)

/**
 * PATCH /api/channels/pinned
 * Reordenar pestañas
 */
async function handlePATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orders } = (await request.json()) as {
      orders: { id: string; order: number }[]
    }

    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: 'Orders array required' }, { status: 400 })
    }

    // Actualización en batch (transacción)
    await db.transaction(async (tx) => {
      for (const item of orders) {
        await tx
          .update(userChannels)
          .set({ pinnedOrder: item.order })
          .where(
            and(
              eq(userChannels.userId, session.userId),
              eq(userChannels.channelId, item.id)
            )
          )
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error reordering pinned channels:', error)
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
}

export const PATCH = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handlePATCH)
