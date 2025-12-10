import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

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

    // Buscar la cuenta del usuario con signer aprobado
    const userAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.ownerId, session.userId),
        eq(accounts.signerStatus, 'approved')
      ),
    })

    if (!userAccount?.signerUuid) {
      return NextResponse.json(
        { error: 'No signer found for this account' },
        { status: 400 }
      )
    }

    // Eliminar el cast usando Neynar
    await neynar.deleteCast({
      signerUuid: userAccount.signerUuid,
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
