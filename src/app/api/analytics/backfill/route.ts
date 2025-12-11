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

    let body = {}
    try {
      body = await request.json()
    } catch {
      // Body vacío es válido
    }
    const { accountId, limit = 50 } = body as { accountId?: string; limit?: number }
    
    console.log('[Analytics Backfill] Request:', { accountId, limit, userId: session.userId })

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
    console.log('[Analytics Backfill] Fetching casts for FID:', account.fid)
    
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${account.fid}&limit=${Math.min(limit, 100)}&include_replies=false`,
      {
        headers: {
          'x-api-key': process.env.NEYNAR_API_KEY || '',
        },
      }
    )
    
    if (!response.ok) {
      const errText = await response.text()
      console.error('[Analytics Backfill] Neynar error:', errText)
      throw new Error(`Neynar API error: ${response.status}`)
    }
    
    const data = await response.json()
    const casts = data.casts || []
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
