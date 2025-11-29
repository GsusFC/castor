import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/accounts
 * Lista todas las cuentas conectadas
 */
export async function GET() {
  try {
    const allAccounts = await db.query.accounts.findMany({
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
    })

    return NextResponse.json({ accounts: allAccounts })
  } catch (error) {
    console.error('[API] Error fetching accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}
