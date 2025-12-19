import { NextRequest, NextResponse } from 'next/server'
import { getSignerStatus, getUserByFid } from '@/lib/farcaster'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getSession } from '@/lib/auth'

/**
 * POST /api/accounts/check-signer
 * Verifica el estado de un signer y registra la cuenta si está aprobado.
 * También permite actualizar el tipo de cuenta (personal/business) post-aprobación.
 * 
 * Body:
 * - signerUuid: string (required)
 * - type?: 'personal' | 'business' (optional, for updating account type)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth required for security
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { signerUuid, type } = body
    
    console.log('[check-signer] Received body:', JSON.stringify(body))

    if (!signerUuid) {
      console.log('[check-signer] ERROR: signerUuid is missing from body')
      return NextResponse.json(
        { error: 'signerUuid is required' },
        { status: 400 }
      )
    }

    // Validate type if provided
    if (type !== undefined && type !== 'personal' && type !== 'business') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "personal" or "business"' },
        { status: 400 }
      )
    }

    const result = await getSignerStatus(signerUuid)
    
    console.log('[check-signer] Status result:', JSON.stringify(result, null, 2))

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const signer = result.signer
    console.log('[check-signer] Signer status:', signer.status, 'FID:', signer.fid)

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
        // Authorization: only owner or admin can update an existing account
        const isOwner = existingAccount.ownerId === session.userId
        const isAdmin = session.role === 'admin'
        const hasNoOwner = !existingAccount.ownerId
        
        if (!isOwner && !isAdmin && !hasNoOwner) {
          console.log('[check-signer] Forbidden: user', session.userId, 'tried to update account owned by', existingAccount.ownerId)
          return NextResponse.json(
            { error: 'You do not have permission to update this account' },
            { status: 403 }
          )
        }
        
        // Actualizar cuenta: signer, status, isPremium, type (if provided), y ownerId si no tiene
        const updates: Record<string, unknown> = {
          signerUuid,
          signerStatus: 'approved',
          isPremium: user.isPremium || false,
          updatedAt: new Date(),
        }
        
        // Update type if provided
        if (type) {
          updates.type = type
          console.log('[check-signer] Updating account type to:', type)
        }
        
        // Si la cuenta no tiene owner, asignar el usuario actual
        if (!existingAccount.ownerId) {
          updates.ownerId = session.userId
          console.log('[check-signer] Assigning ownerId to existing account:', session.userId)
        }
        
        await db
          .update(accounts)
          .set(updates)
          .where(eq(accounts.id, existingAccount.id))
        
        console.log('[check-signer] Updated existing account:', existingAccount.id, existingAccount.username, 'isPro:', user.isPremium)

        return NextResponse.json({
          status: 'approved',
          account: { ...existingAccount, ...updates },
          isNew: false,
        })
      }

      // Crear nueva cuenta (type defaults to 'personal' - safe default)
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
        ownerId: session.userId,
      }

      await db.insert(accounts).values(newAccount)
      console.log('[check-signer] New account created:', newAccount.id, newAccount.username)

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
