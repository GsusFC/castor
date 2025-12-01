import { NextRequest, NextResponse } from 'next/server'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

/**
 * POST /api/accounts/[id]/share
 * Compartir o dejar de compartir una cuenta
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Solo admins pueden compartir
    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can share accounts' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { isShared } = await request.json()

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Actualizar estado de compartir
    await db.update(accounts)
      .set({
        isShared: Boolean(isShared),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, id))

    return NextResponse.json({
      success: true,
      isShared: Boolean(isShared),
    })
  } catch (error) {
    console.error('[API] Error sharing account:', error)
    return NextResponse.json(
      { error: 'Failed to update account sharing' },
      { status: 500 }
    )
  }
}
