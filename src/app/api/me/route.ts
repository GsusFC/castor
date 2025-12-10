import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Buscar la cuenta del usuario
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.fid, session.fid),
    })

    return NextResponse.json({
      fid: session.fid,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      pfpUrl: session.pfpUrl,
      accountId: account?.id || null,
      isPro: account?.isPremium || false,
    })
  } catch (error) {
    console.error('[Me API] Error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
