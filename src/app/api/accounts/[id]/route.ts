import { NextRequest, NextResponse } from 'next/server'
import { db, accounts, scheduledCasts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada' },
        { status: 404 }
      )
    }

    // Eliminar casts programados de esta cuenta
    await db.delete(scheduledCasts).where(eq(scheduledCasts.accountId, id))

    // Eliminar la cuenta
    await db.delete(accounts).where(eq(accounts.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting account:', error)
    return NextResponse.json(
      { error: 'Error al eliminar la cuenta' },
      { status: 500 }
    )
  }
}
