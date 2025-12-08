import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { targetFid } = await request.json()

    if (!targetFid) {
      return NextResponse.json({ error: 'targetFid is required' }, { status: 400 })
    }

    // Obtener cuenta con signer aprobado
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.ownerId, session.userId),
          eq(accounts.signerStatus, 'approved')
        )
      )
      .limit(1)

    if (!account?.signerUuid) {
      return NextResponse.json(
        { error: 'No tienes un signer aprobado. Conecta tu cuenta de Farcaster primero.' },
        { status: 400 }
      )
    }

    await neynar.followUser({
      signerUuid: account.signerUuid,
      targetFids: [targetFid],
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Follow API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to follow user' },
      { status: 500 }
    )
  }
}
