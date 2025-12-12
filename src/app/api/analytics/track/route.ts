import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, castAnalytics, accounts, accountMembers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { neynar } from '@/lib/farcaster/client'

/**
 * POST /api/analytics/track
 * Registrar un cast publicado para tracking
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { castHash, accountId, content } = await request.json()

    if (!castHash || !accountId) {
      return NextResponse.json({ error: 'castHash and accountId required' }, { status: 400 })
    }

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

    const hasAccess = session.role === 'admin' || account.ownerId === session.userId || !!membership
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Obtener métricas actuales del cast
    let likes = 0, recasts = 0, replies = 0
    try {
      const castData = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier: castHash,
        type: 'hash',
      })
      if (castData.cast) {
        likes = castData.cast.reactions?.likes_count || 0
        recasts = castData.cast.reactions?.recasts_count || 0
        replies = castData.cast.replies?.count || 0
      }
    } catch {
      // Si no se puede obtener, usar 0
    }

    // Verificar si ya existe
    const existing = await db.query.castAnalytics.findFirst({
      where: eq(castAnalytics.castHash, castHash),
    })

    if (existing) {
      // Actualizar métricas
      await db
        .update(castAnalytics)
        .set({
          likes,
          recasts,
          replies,
          lastUpdatedAt: new Date(),
        })
        .where(eq(castAnalytics.id, existing.id))

      return NextResponse.json({ success: true, updated: true })
    }

    // Crear nuevo registro
    await db.insert(castAnalytics).values({
      id: crypto.randomUUID(),
      castHash,
      accountId,
      content: content || '',
      likes,
      recasts,
      replies,
      publishedAt: new Date(),
    })

    return NextResponse.json({ success: true, created: true })
  } catch (error) {
    console.error('[Analytics Track] Error:', error)
    return NextResponse.json({ error: 'Failed to track cast' }, { status: 500 })
  }
}

/**
 * PUT /api/analytics/track
 * Actualizar métricas de todos los casts trackeados (para cron job)
 */
export async function PUT(request: NextRequest) {
  try {
    // Obtener todos los casts de los últimos 7 días
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - 7)

    const castsToUpdate = await db.query.castAnalytics.findMany({
      where: (table, { gte }) => gte(table.publishedAt, dateLimit),
    })

    let updated = 0
    for (const cast of castsToUpdate) {
      try {
        const castData = await neynar.lookupCastByHashOrWarpcastUrl({
          identifier: cast.castHash,
          type: 'hash',
        })

        if (castData.cast) {
          await db
            .update(castAnalytics)
            .set({
              likes: castData.cast.reactions?.likes_count || 0,
              recasts: castData.cast.reactions?.recasts_count || 0,
              replies: castData.cast.replies?.count || 0,
              lastUpdatedAt: new Date(),
            })
            .where(eq(castAnalytics.id, cast.id))
          updated++
        }
      } catch {
        // Skip si falla un cast individual
      }
    }

    return NextResponse.json({ success: true, updated, total: castsToUpdate.length })
  } catch (error) {
    console.error('[Analytics Update] Error:', error)
    return NextResponse.json({ error: 'Failed to update analytics' }, { status: 500 })
  }
}
