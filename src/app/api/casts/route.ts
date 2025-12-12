import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts, accounts, accountMembers } from '@/lib/db'
import { eq, desc, or, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

/**
 * GET /api/casts
 * Lista todos los casts programados
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const accountId = searchParams.get('accountId')

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: {
        accountId: true,
      },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    const accessibleAccounts = await db.query.accounts.findMany({
      where: memberAccountIds.length > 0
        ? or(
            eq(accounts.ownerId, session.userId),
            inArray(accounts.id, memberAccountIds)
          )
        : eq(accounts.ownerId, session.userId),
      columns: {
        id: true,
      },
    })

    const accessibleAccountIds = accessibleAccounts.map(a => a.id)

    if (accountId && !accessibleAccountIds.includes(accountId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (accessibleAccountIds.length === 0) {
      return NextResponse.json({ casts: [] })
    }

    const casts = await db.query.scheduledCasts.findMany({
      where: inArray(scheduledCasts.accountId, accountId ? [accountId] : accessibleAccountIds),
      with: {
        account: true,
      },
      orderBy: [desc(scheduledCasts.scheduledAt)],
    })

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
