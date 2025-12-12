import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scheduledCasts, threads, castMedia, accounts, accountMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession, canAccess } from '@/lib/auth'

function generateId() {
  return crypto.randomUUID()
}

interface CastInput {
  content: string
  embeds?: { url: string }[]
}

export async function POST(request: NextRequest) {
  try {
    // Obtener usuario actual
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accountId, channelId, scheduledAt, casts } = body as {
      accountId: string
      channelId?: string
      scheduledAt: string
      casts: CastInput[]
    }

    // Validaciones
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    if (!casts || casts.length === 0) {
      return NextResponse.json({ error: 'casts array is required' }, { status: 400 })
    }

    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
    }

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const threadId = generateId()

    // Crear el thread
    await db.insert(threads).values({
      id: threadId,
      accountId,
      title: casts[0].content.substring(0, 50),
      status: 'scheduled',
      scheduledAt: new Date(scheduledAt),
    })

    // Crear cada cast del thread
    for (let i = 0; i < casts.length; i++) {
      const cast = casts[i]
      const castId = generateId()

      await db.insert(scheduledCasts).values({
        id: castId,
        accountId,
        content: cast.content.trim(),
        scheduledAt: new Date(scheduledAt),
        channelId: channelId || null,
        status: 'scheduled',
        threadId,
        threadOrder: i,
        createdById: session.userId,
      })

      // Guardar media si hay embeds
      if (cast.embeds && cast.embeds.length > 0) {
        for (let j = 0; j < cast.embeds.length; j++) {
          const embed = cast.embeds[j]
          await db.insert(castMedia).values({
            id: generateId(),
            castId,
            url: embed.url,
            type: embed.url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
            order: j,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      threadId,
      castsCount: casts.length,
    })
  } catch (error) {
    console.error('[API] Error scheduling thread:', error)
    return NextResponse.json(
      { error: 'Failed to schedule thread' },
      { status: 500 }
    )
  }
}
