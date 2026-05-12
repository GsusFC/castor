import { NextResponse } from 'next/server'
import { db, accounts, accountMembers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { neynar } from '@/lib/farcaster/client'
import { eq, or, inArray } from 'drizzle-orm'

const PROFILE_REFRESH_MS = 3600_000 // 1 hora

async function refreshAccountFromNeynar(account: typeof accounts.$inferSelect) {
  try {
    const response = await neynar.fetchBulkUsers({ fids: [account.fid] })
    const user = response.users[0]
    if (!user) return account

    const newPfp = user.pfp_url ?? account.pfpUrl
    const newDisplay = user.display_name ?? account.displayName

    if (newPfp !== account.pfpUrl || newDisplay !== account.displayName) {
      await db.update(accounts)
        .set({ pfpUrl: newPfp, displayName: newDisplay, updatedAt: new Date() })
        .where(eq(accounts.id, account.id))
      console.log(`[Accounts] Refreshed profile for ${account.username}: pfp=${!!newPfp}, display=${newDisplay}`)
      return { ...account, pfpUrl: newPfp, displayName: newDisplay }
    }

    // Update timestamp even if no changes (prevents checking every request)
    await db.update(accounts)
      .set({ updatedAt: new Date() })
      .where(eq(accounts.id, account.id))

    return account
  } catch {
    console.warn(`[Accounts] Failed to refresh profile for ${account.username}`)
    return account
  }
}

/**
 * GET /api/accounts
 * Lista las cuentas del usuario actual + las compartidas
 * Refresca datos de perfil desde Neynar si están stale (>1h)
 */
export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: { accountId: true },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    const userAccounts = await db.query.accounts.findMany({
      where: memberAccountIds.length > 0
        ? or(eq(accounts.ownerId, session.userId), inArray(accounts.id, memberAccountIds))
        : eq(accounts.ownerId, session.userId),
      with: {
        owner: {
          columns: { id: true, username: true, displayName: true, pfpUrl: true },
        },
      },
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
    })

    // Refresh stale profiles from Neynar
    const now = Date.now()
    const refreshed = await Promise.all(
      userAccounts.map(async (account) => {
        const updatedAt = account.updatedAt ? new Date(account.updatedAt).getTime() : 0
        if (now - updatedAt > PROFILE_REFRESH_MS) {
          return refreshAccountFromNeynar(account)
        }
        return account
      })
    )

    console.log('[GET /api/accounts] Found accounts:', refreshed.length)

    return NextResponse.json({ accounts: refreshed })
  } catch (error) {
    console.error('[API] Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}