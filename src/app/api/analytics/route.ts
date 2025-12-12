import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, castAnalytics, accountMembers } from '@/lib/db'
import { eq, or, and, gte, desc, sql, inArray } from 'drizzle-orm'

/**
 * GET /api/analytics
 * Obtener métricas de casts publicados con Castor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const accountIdFilter = searchParams.get('accountId')

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: {
        accountId: true,
      },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    // Obtener solo las cuentas del usuario (propias o donde es miembro)
    const userAccounts = await db.query.accounts.findMany({
      where: memberAccountIds.length > 0
        ? or(
            eq(accounts.ownerId, session.userId),
            inArray(accounts.id, memberAccountIds)
          )
        : eq(accounts.ownerId, session.userId),
    })

    const accountIds = userAccounts.map(a => a.id)
    if (accountIds.length === 0) {
      return NextResponse.json({
        totals: { casts: 0, likes: 0, recasts: 0, replies: 0 },
        topCasts: [],
        accounts: [],
        period: { days },
      })
    }

    // Filtrar por fecha
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    // Construir filtro
    const baseFilter = accountIdFilter
      ? and(eq(castAnalytics.accountId, accountIdFilter), gte(castAnalytics.publishedAt, dateFrom))
      : and(inArray(castAnalytics.accountId, accountIds), gte(castAnalytics.publishedAt, dateFrom))

    // Obtener todos los casts del período
    const casts = await db.query.castAnalytics.findMany({
      where: baseFilter,
      orderBy: [desc(castAnalytics.publishedAt)],
    })

    // Calcular totales
    const totals = casts.reduce(
      (acc, cast) => ({
        casts: acc.casts + 1,
        likes: acc.likes + cast.likes,
        recasts: acc.recasts + cast.recasts,
        replies: acc.replies + cast.replies,
      }),
      { casts: 0, likes: 0, recasts: 0, replies: 0 }
    )

    // Top casts por engagement (likes + recasts + replies)
    const topCasts = [...casts]
      .sort((a, b) => (b.likes + b.recasts + b.replies) - (a.likes + a.recasts + a.replies))
      .slice(0, 10)
      .map(cast => ({
        id: cast.id,
        castHash: cast.castHash,
        content: cast.content,
        likes: cast.likes,
        recasts: cast.recasts,
        replies: cast.replies,
        publishedAt: cast.publishedAt,
      }))

    // Stats por cuenta
    const accountsWithStats = userAccounts.map(account => {
      const accountCasts = casts.filter(c => c.accountId === account.id)
      return {
        id: account.id,
        fid: account.fid,
        username: account.username,
        displayName: account.displayName,
        pfpUrl: account.pfpUrl,
        stats: accountCasts.reduce(
          (acc, cast) => ({
            casts: acc.casts + 1,
            likes: acc.likes + cast.likes,
            recasts: acc.recasts + cast.recasts,
            replies: acc.replies + cast.replies,
          }),
          { casts: 0, likes: 0, recasts: 0, replies: 0 }
        ),
      }
    })

    return NextResponse.json({
      totals,
      topCasts,
      accounts: accountsWithStats,
      period: { days },
    })
  } catch (error) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
