import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { getUserByFid } from '@/lib/farcaster/client'

/**
 * POST /api/accounts/sync-pro
 * Sincroniza el estado Pro de todas las cuentas del usuario
 */
export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener todas las cuentas del usuario
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.ownerId, session.userId),
    })

    if (userAccounts.length === 0) {
      return NextResponse.json({ updated: 0 })
    }

    // Sincronizar estado Pro para cada cuenta
    const updates: { fid: number; isPremium: boolean }[] = []

    for (const account of userAccounts) {
      const result = await getUserByFid(account.fid)
      if (result.success) {
        const isPremium = result.user.isPremium || false
        if (account.isPremium !== isPremium) {
          updates.push({ fid: account.fid, isPremium })
        }
      }
    }

    // Aplicar actualizaciones
    for (const update of updates) {
      await db
        .update(accounts)
        .set({ isPremium: update.isPremium, updatedAt: new Date() })
        .where(eq(accounts.fid, update.fid))
    }

    console.log('[sync-pro] Updated', updates.length, 'accounts')

    return NextResponse.json({
      updated: updates.length,
      accounts: updates.map(u => ({ fid: u.fid, isPremium: u.isPremium })),
    })
  } catch (error) {
    console.error('[sync-pro] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Pro status' },
      { status: 500 }
    )
  }
}
