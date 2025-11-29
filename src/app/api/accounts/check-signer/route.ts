import { NextRequest, NextResponse } from 'next/server'
import { getSignerStatus, getUserByFid } from '@/lib/farcaster'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

/**
 * POST /api/accounts/check-signer
 * Verifica el estado de un signer y registra la cuenta si está aprobado
 */
export async function POST(request: NextRequest) {
  try {
    const { signerUuid } = await request.json()

    if (!signerUuid) {
      return NextResponse.json(
        { error: 'signerUuid is required' },
        { status: 400 }
      )
    }

    const result = await getSignerStatus(signerUuid)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const signer = result.signer

    // Si el signer está aprobado, registrar/actualizar la cuenta
    if (signer.status === 'approved' && signer.fid) {
      // Obtener info del usuario
      const userResult = await getUserByFid(signer.fid)

      if (!userResult.success) {
        return NextResponse.json(
          { error: 'Failed to fetch user info' },
          { status: 500 }
        )
      }

      const user = userResult.user

      // Verificar si ya existe la cuenta
      const existingAccount = await db.query.accounts.findFirst({
        where: eq(accounts.fid, signer.fid),
      })

      if (existingAccount) {
        // Actualizar signer si cambió
        if (existingAccount.signerUuid !== signerUuid) {
          await db
            .update(accounts)
            .set({
              signerUuid,
              signerStatus: 'approved',
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, existingAccount.id))
        }

        return NextResponse.json({
          status: 'approved',
          account: existingAccount,
          isNew: false,
        })
      }

      // Crear nueva cuenta
      const newAccount = {
        id: generateId(),
        fid: signer.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        signerUuid,
        signerStatus: 'approved' as const,
        type: 'personal' as const,
        isPremium: user.isPremium || false,
      }

      await db.insert(accounts).values(newAccount)

      return NextResponse.json({
        status: 'approved',
        account: newAccount,
        isNew: true,
      })
    }

    // Signer pendiente o revocado
    return NextResponse.json({
      status: signer.status,
      fid: signer.fid,
    })
  } catch (error) {
    console.error('[API] Error checking signer:', error)
    return NextResponse.json(
      { error: 'Failed to check signer status' },
      { status: 500 }
    )
  }
}
