import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { eq, and, inArray, or } from 'drizzle-orm'

/**
 * DELETE /api/feed/cast/[hash]
 * Elimina un cast publicado en Farcaster
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { hash } = await params

    if (!hash || !hash.startsWith('0x')) {
      return NextResponse.json(
        { error: 'Invalid cast hash' },
        { status: 400 }
      )
    }

    // Lookup del cast para saber el author fid (necesario para escoger el signer correcto)
    const lookup = await neynar.lookupCastByHashOrWarpcastUrl({
      identifier: hash,
      type: 'hash',
    })

    const authorFid = lookup.cast?.author?.fid
    if (!Number.isFinite(authorFid)) {
      return NextResponse.json(
        { error: 'Could not resolve cast author' },
        { status: 400 }
      )
    }

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: {
        accountId: true,
      },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    const accountForAuthor = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.fid, authorFid),
        eq(accounts.signerStatus, 'approved'),
        memberAccountIds.length > 0
          ? or(
              eq(accounts.ownerId, session.userId),
              inArray(accounts.id, memberAccountIds)
            )
          : eq(accounts.ownerId, session.userId)
      ),
    })

    if (!accountForAuthor?.signerUuid) {
      return NextResponse.json(
        { error: 'You can only delete casts from accounts you manage' },
        { status: 403 }
      )
    }

    // Eliminar el cast usando Neynar
    await neynar.deleteCast({
      signerUuid: accountForAuthor.signerUuid,
      targetHash: hash,
    })

    console.log('[Delete Cast] Deleted:', hash)

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[Delete Cast] Error:', error)
    
    // Manejar errores específicos de Neynar
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Cast not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'You can only delete your own casts' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete cast' },
      { status: 500 }
    )
  }
}
