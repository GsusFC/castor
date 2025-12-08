import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { castHash, reactionType } = await request.json()

    if (!castHash || !reactionType) {
      return NextResponse.json(
        { error: 'castHash and reactionType are required' },
        { status: 400 }
      )
    }

    if (!['like', 'recast'].includes(reactionType)) {
      return NextResponse.json(
        { error: 'reactionType must be "like" or "recast"' },
        { status: 400 }
      )
    }

    // Obtener signer del usuario
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.fid, session.fid),
    })

    const accountWithSigner = userAccounts.find(a => a.signerUuid && a.signerStatus === 'approved')
    
    if (!accountWithSigner?.signerUuid) {
      return NextResponse.json(
        { error: 'No approved signer found' },
        { status: 400 }
      )
    }

    if (reactionType === 'like') {
      await neynar.publishReaction({
        signerUuid: accountWithSigner.signerUuid,
        reactionType: 'like',
        target: castHash,
      })
    } else {
      await neynar.publishReaction({
        signerUuid: accountWithSigner.signerUuid,
        reactionType: 'recast',
        target: castHash,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reaction API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to publish reaction' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { castHash, reactionType } = await request.json()

    if (!castHash || !reactionType) {
      return NextResponse.json(
        { error: 'castHash and reactionType are required' },
        { status: 400 }
      )
    }

    if (!['like', 'recast'].includes(reactionType)) {
      return NextResponse.json(
        { error: 'reactionType must be "like" or "recast"' },
        { status: 400 }
      )
    }

    // Obtener signer del usuario
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.fid, session.fid),
    })

    const accountWithSigner = userAccounts.find(a => a.signerUuid && a.signerStatus === 'approved')
    
    if (!accountWithSigner?.signerUuid) {
      return NextResponse.json(
        { error: 'No approved signer found' },
        { status: 400 }
      )
    }

    await neynar.deleteReaction({
      signerUuid: accountWithSigner.signerUuid,
      reactionType: reactionType as 'like' | 'recast',
      target: castHash,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reaction DELETE API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete reaction' },
      { status: 500 }
    )
  }
}
