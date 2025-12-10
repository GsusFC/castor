import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/social/[fid]/follow
 * Seguir a un usuario
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fid } = await params
    const targetFid = parseInt(fid)

    if (isNaN(targetFid)) {
      return NextResponse.json({ error: 'Invalid FID' }, { status: 400 })
    }

    // Obtener cuenta del usuario con signer
    const userAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.ownerId, session.userId),
        eq(accounts.signerStatus, 'approved')
      ),
    })

    if (!userAccount?.signerUuid) {
      return NextResponse.json({ error: 'No signer found' }, { status: 400 })
    }

    // No puedes seguirte a ti mismo
    if (userAccount.fid === targetFid) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    await neynar.followUser({
      signerUuid: userAccount.signerUuid,
      targetFids: [targetFid],
    })

    return NextResponse.json({ success: true, following: true })
  } catch (error) {
    console.error('[Follow] Error:', error)
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 })
  }
}

/**
 * DELETE /api/social/[fid]/follow
 * Dejar de seguir a un usuario
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fid } = await params
    const targetFid = parseInt(fid)

    if (isNaN(targetFid)) {
      return NextResponse.json({ error: 'Invalid FID' }, { status: 400 })
    }

    // Obtener cuenta del usuario con signer
    const userAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.ownerId, session.userId),
        eq(accounts.signerStatus, 'approved')
      ),
    })

    if (!userAccount?.signerUuid) {
      return NextResponse.json({ error: 'No signer found' }, { status: 400 })
    }

    await neynar.unfollowUser({
      signerUuid: userAccount.signerUuid,
      targetFids: [targetFid],
    })

    return NextResponse.json({ success: true, following: false })
  } catch (error) {
    console.error('[Unfollow] Error:', error)
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 })
  }
}
