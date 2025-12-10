import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, castAnalytics, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'
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

    const { accountId, limit = 50 } = await request.json()

    // Obtener cuenta
    let account = accountId
      ? await db.query.accounts.findFirst({
          where: eq(accounts.id, accountId),
        })
      : await db.query.accounts.findFirst({
          where: eq(accounts.ownerId, session.userId),
        })
    
    // Fallback: si no hay por ownerId, buscar cualquier cuenta aprobada
    if (!account && !accountId) {
      account = await db.query.accounts.findFirst({
        where: eq(accounts.signerStatus, 'approved'),
      })
    }

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Obtener casts del usuario desde Neynar
    const response = await neynar.fetchFeed({
      feedType: 'filter',
      filterType: 'fids',
      fid: account.fid,
      fids: account.fid.toString(),
      limit: Math.min(limit, 100),
    })

    const casts = response.casts || []
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
    console.error('[Analytics Backfill] Error:', error)
    return NextResponse.json({ error: 'Failed to backfill analytics' }, { status: 500 })
  }
}
