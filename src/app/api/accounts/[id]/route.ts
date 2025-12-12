import { NextRequest, NextResponse } from 'next/server'
import { db, accounts, scheduledCasts, templates } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    })

    if (!account) {
      return ApiErrors.notFound('Account')
    }

    // Verificar permisos (solo owner o admin pueden eliminar)
    const canDelete = session.role === 'admin' || account.ownerId === session.userId
    if (!canDelete) {
      return ApiErrors.forbidden('Only the account owner can delete it')
    }

    // Eliminar en transacción
    await db.transaction(async (tx) => {
      // Eliminar templates de esta cuenta
      await tx.delete(templates).where(eq(templates.accountId, id))
      // Eliminar casts programados de esta cuenta
      await tx.delete(scheduledCasts).where(eq(scheduledCasts.accountId, id))
      // Eliminar la cuenta
      await tx.delete(accounts).where(eq(accounts.id, id))
    })

    return success({ deleted: true })
  } catch (error) {
    console.error('[API] Error deleting account:', error)
    return ApiErrors.operationFailed('Failed to delete account')
  }
}
