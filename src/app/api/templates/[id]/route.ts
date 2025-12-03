import { NextRequest } from 'next/server'
import { db, accounts } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession, canAccess, canModify } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, updateTemplateSchema } from '@/lib/validations'

// Helper para obtener template con verificación de permisos
async function getTemplateWithAuth(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))

  if (!template) {
    return { error: ApiErrors.notFound('Template') }
  }

  // Obtener la cuenta asociada para verificar permisos
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, template.accountId),
  })

  if (!account) {
    return { error: ApiErrors.notFound('Account') }
  }

  const hasAccess = canAccess(session, { ownerId: account.ownerId, isShared: account.isShared })
  if (!hasAccess) {
    return { error: ApiErrors.forbidden('No access to this template') }
  }

  return { template, account }
}

// GET /api/templates/[id] - Obtener un template específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params
    const result = await getTemplateWithAuth(id, session)
    
    if ('error' in result) {
      return result.error
    }

    return success({ template: result.template })
  } catch (error) {
    console.error('Error fetching template:', error)
    return ApiErrors.operationFailed('Failed to fetch template')
  }
}

// PATCH /api/templates/[id] - Actualizar un template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params
    const body = await request.json()

    // Validar input
    const validation = validate(updateTemplateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const result = await getTemplateWithAuth(id, session)
    if ('error' in result) {
      return result.error
    }

    const { name, content, channelId } = validation.data

    await db
      .update(templates)
      .set({
        ...(name && { name }),
        ...(content && { content }),
        ...(channelId !== undefined && { channelId: channelId || null }),
        updatedAt: new Date(),
      })
      .where(eq(templates.id, id))

    const [updated] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    return success({ template: updated })
  } catch (error) {
    console.error('Error updating template:', error)
    return ApiErrors.operationFailed('Failed to update template')
  }
}

// DELETE /api/templates/[id] - Eliminar un template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { id } = await params
    const result = await getTemplateWithAuth(id, session)
    
    if ('error' in result) {
      return result.error
    }

    await db.delete(templates).where(eq(templates.id, id))

    return success({ deleted: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return ApiErrors.operationFailed('Failed to delete template')
  }
}
