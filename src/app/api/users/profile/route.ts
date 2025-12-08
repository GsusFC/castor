import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { bio, displayName, pfpUrl, url } = await request.json()

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
        { error: 'No tienes un signer aprobado' },
        { status: 400 }
      )
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: {
      signerUuid: string
      bio?: string
      displayName?: string
      pfpUrl?: string
      url?: string
    } = {
      signerUuid: account.signerUuid,
    }

    if (bio !== undefined) updateData.bio = bio
    if (displayName !== undefined) updateData.displayName = displayName
    if (pfpUrl !== undefined) updateData.pfpUrl = pfpUrl
    if (url !== undefined) updateData.url = url

    const response = await neynar.updateUser(updateData)

    // Actualizar también en nuestra DB si cambió displayName o pfpUrl
    if (displayName || pfpUrl) {
      await db
        .update(accounts)
        .set({
          ...(displayName && { displayName }),
          ...(pfpUrl && { pfpUrl }),
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, account.id))
    }

    return NextResponse.json({ 
      success: true,
      user: response 
    })
  } catch (error) {
    console.error('[Profile Update API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
