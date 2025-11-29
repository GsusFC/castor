import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/casts
 * Lista todos los casts programados
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const accountId = searchParams.get('accountId')

    let query = db.query.scheduledCasts.findMany({
      with: {
        account: true,
      },
      orderBy: [desc(scheduledCasts.scheduledAt)],
    })

    const casts = await query

    // Filtrar en memoria (Drizzle con SQLite tiene limitaciones en queries complejas)
    let filteredCasts = casts

    if (status) {
      filteredCasts = filteredCasts.filter((c) => c.status === status)
    }

    if (accountId) {
      filteredCasts = filteredCasts.filter((c) => c.accountId === accountId)
    }

    return NextResponse.json({ casts: filteredCasts })
  } catch (error) {
    console.error('[API] Error fetching casts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch casts' },
      { status: 500 }
    )
  }
}
