import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { eq, inArray, or } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Buscar la cuenta personal del usuario (para compatibilidad con UI actual)
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.fid, session.fid),
    })

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
        fid: true,
      },
    })

    const manageableFids = accessibleAccounts
      .map(a => a.fid)
      .filter((fid): fid is number => typeof fid === 'number' && Number.isFinite(fid))

    return NextResponse.json({
      fid: session.fid,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      pfpUrl: session.pfpUrl,
      accountId: account?.id || null,
      signerUuid: account?.signerUuid || null,
      isPro: account?.isPremium || false,
      manageableFids,
    })
  } catch (error) {
    console.error('[Me API] Error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
