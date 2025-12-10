import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'

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

    // Obtener todas las cuentas
    const userAccounts = await db.query.accounts.findMany()

    // Por ahora devolver estructura básica sin analytics (la tabla puede no existir)
    const accountsWithStats = userAccounts.map(account => ({
      id: account.id,
      fid: account.fid,
      username: account.username,
      displayName: account.displayName,
      pfpUrl: account.pfpUrl,
      stats: { casts: 0, likes: 0, recasts: 0, replies: 0 },
    }))

    return NextResponse.json({
      totals: { casts: 0, likes: 0, recasts: 0, replies: 0 },
      topCasts: [],
      accounts: accountsWithStats,
      period: { days },
    })
  } catch (error) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
