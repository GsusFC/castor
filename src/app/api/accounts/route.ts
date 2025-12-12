import { NextResponse } from 'next/server'
import { db, accounts, accountMembers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { eq, or, inArray } from 'drizzle-orm'

/**
 * GET /api/accounts
 * Lista las cuentas del usuario actual + las compartidas
 */
export async function GET() {
  try {
    const session = await getSession()
    
    console.log('[GET /api/accounts] Session:', session?.userId, session?.role)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: {
        accountId: true,
      },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    // Obtener cuentas propias + donde es miembro
    const userAccounts = await db.query.accounts.findMany({
      where: memberAccountIds.length > 0
        ? or(
            eq(accounts.ownerId, session.userId),
            inArray(accounts.id, memberAccountIds)
          )
        : eq(accounts.ownerId, session.userId),
      with: {
        owner: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            pfpUrl: true,
          },
        },
      },
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
    })
    
    console.log('[GET /api/accounts] Found accounts:', userAccounts.length, userAccounts.map(a => ({ id: a.id, ownerId: a.ownerId, username: a.username })))

    return NextResponse.json({ accounts: userAccounts })
  } catch (error) {
    console.error('[API] Error fetching accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}
