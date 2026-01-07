import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, castAnalytics, accounts, accountMembers } from '@/lib/db'
import { eq, and, or, inArray } from 'drizzle-orm'
import { neynar } from '@/lib/farcaster/client'

/**
 * POST /api/analytics/backfill
 * Importar casts históricos de una cuenta para analytics
 */
export async function POST(request: NextRequest) {
  try {

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body = {}
    try {
      body = await request.json()
    } catch {
      // Body vacío es válido
    }
    const { accountId, limit = 50 } = body as { accountId?: string; limit?: number }

    console.log('[Analytics Backfill] Request:', { accountId, limit, userId: session.userId })

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: {
        accountId: true,
      },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    // Construir set de cuentas accesibles
    const accessibleAccounts = await db.query.accounts.findMany({
      where: memberAccountIds.length > 0
        ? or(
          eq(accounts.ownerId, session.userId),
          inArray(accounts.id, memberAccountIds)
        )
        : eq(accounts.ownerId, session.userId),
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
    })

    const requestedAccount = accountId
      ? accessibleAccounts.find(a => a.id === accountId) ?? null
      : null

    if (accountId && !requestedAccount) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const account = requestedAccount ?? (accessibleAccounts.find(a => a.ownerId === session.userId) ?? accessibleAccounts[0] ?? null)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Obtener casts del usuario desde Neynar
    console.log('[Analytics Backfill] Fetching casts for FID:', account.fid)

    const response = await neynar.fetchFeed({
      feedType: 'filter',
      filterType: 'fids',
      fids: account.fid.toString(),
      limit: Math.min(limit, 100),
      withRecasts: true,
    })

    const casts = response.casts || []
    console.log('[Analytics Backfill] Found', casts.length, 'casts')
    let imported = 0
    let skipped = 0

    for (const cast of casts) {
      // Verificar si ya existe
      const existing = await db.query.castAnalytics.findFirst({
        where: eq(castAnalytics.castHash, cast.hash),
      })

      if (existing) {
        // Actualizar métricas
        await db
          .update(castAnalytics)
          .set({
            likes: cast.reactions?.likes_count || 0,
            recasts: cast.reactions?.recasts_count || 0,
            replies: cast.replies?.count || 0,
            lastUpdatedAt: new Date(),
          })
          .where(eq(castAnalytics.id, existing.id))
        skipped++
        continue
      }

      // Crear nuevo registro
      const now = new Date()
      await db.insert(castAnalytics).values({
        id: crypto.randomUUID(),
        castHash: cast.hash,
        accountId: account.id,
        content: cast.text?.slice(0, 500) || '',
        likes: cast.reactions?.likes_count || 0,
        recasts: cast.reactions?.recasts_count || 0,
        replies: cast.replies?.count || 0,
        publishedAt: new Date(cast.timestamp),
        lastUpdatedAt: now,
        createdAt: now,
      })
      imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: casts.length,
      account: {
        username: account.username,
        fid: account.fid,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Analytics Backfill] Error:', errorMessage, error)
    return NextResponse.json({
      error: 'Failed to backfill analytics',
      details: errorMessage
    }, { status: 500 })
  }
}
