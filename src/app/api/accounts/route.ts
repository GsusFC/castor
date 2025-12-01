import { NextResponse } from 'next/server'
import { db, accounts } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { eq, or } from 'drizzle-orm'

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

    // Obtener cuentas propias + compartidas
    const userAccounts = await db.query.accounts.findMany({
      where: or(
        eq(accounts.ownerId, session.userId),
        eq(accounts.isShared, true)
      ),
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
