import { NextRequest } from 'next/server'
import { db, accounts, accountMembers } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and, exists } from 'drizzle-orm'
import { getSession, canAccess } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, updateTemplateSchema } from '@/lib/validations'

const formatServerTiming = (metrics: Record<string, number>) =>
  Object.entries(metrics)
    .filter(([, value]) => Number.isFinite(value))
    .map(([name, value]) => `${name};dur=${value.toFixed(1)}`)
    .join(', ')

const withServerTiming = (response: Response, metrics: Record<string, number>) => {
  const value = formatServerTiming(metrics)
  if (value) {
    response.headers.set('Server-Timing', value)
  }
  return response
}

type TemplateWithAuthResult =
  | { kind: 'error'; response: ReturnType<(typeof ApiErrors)[keyof typeof ApiErrors]> }
  | { kind: 'ok'; template: typeof templates.$inferSelect }

// Helper para obtener template con verificación de permisos
async function getTemplateWithAuth(
  id: string,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
): Promise<TemplateWithAuthResult> {
  const [row] = await db
    .select({
      template: templates,
      ownerId: accounts.ownerId,
      isMember: exists(
        db
          .select({ id: accountMembers.id })
          .from(accountMembers)
          .where(and(eq(accountMembers.userId, session.userId), eq(accountMembers.accountId, accounts.id)))
      ),
    })
    .from(templates)
    .innerJoin(accounts, eq(accounts.id, templates.accountId))
    .where(eq(templates.id, id))

  if (!row) {
    return { kind: 'error', response: ApiErrors.notFound('Template') }
  }

  const hasAccess = canAccess(session, { ownerId: row.ownerId, isMember: Boolean(row.isMember) })
  if (!hasAccess) {
    return { kind: 'error', response: ApiErrors.forbidden('No access to this template') }
  }

  return { kind: 'ok', template: row.template }
}

// GET /api/templates/[id] - Obtener un template específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const totalStart = Date.now()
    let authMs = 0
    let dbMs = 0

    const authStart = Date.now()
    const session = await getSession()
    authMs = Date.now() - authStart
    if (!session) {
      return withServerTiming(ApiErrors.unauthorized(), { auth: authMs, total: Date.now() - totalStart })
    }

    const { id } = await params
    const dbStart = Date.now()
    const result = await getTemplateWithAuth(id, session)
    dbMs += Date.now() - dbStart
    
    if (result.kind === 'error') {
      return withServerTiming(result.response, { auth: authMs, db: dbMs, total: Date.now() - totalStart })
    }

    return withServerTiming(success({ template: result.template }), {
      auth: authMs,
      db: dbMs,
      total: Date.now() - totalStart,
    })
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
    const totalStart = Date.now()
    let authMs = 0
    let dbMs = 0

    const authStart = Date.now()
    const session = await getSession()
    authMs = Date.now() - authStart
    if (!session) {
      return withServerTiming(ApiErrors.unauthorized(), { auth: authMs, total: Date.now() - totalStart })
    }

    const { id } = await params
    const body = await request.json()

    // Validar input
    const validation = validate(updateTemplateSchema, body)
    if (!validation.success) {
      return withServerTiming(validation.error, { auth: authMs, total: Date.now() - totalStart })
    }

    const authTemplateStart = Date.now()
    const result = await getTemplateWithAuth(id, session)
    dbMs += Date.now() - authTemplateStart
    if (result.kind === 'error') {
      return withServerTiming(result.response, { auth: authMs, db: dbMs, total: Date.now() - totalStart })
    }

    const { name, content, channelId } = validation.data

    const updateStart = Date.now()
    await db
      .update(templates)
      .set({
        ...(name && { name }),
        ...(content && { content }),
        ...(channelId !== undefined && { channelId: channelId || null }),
        updatedAt: new Date(),
      })
      .where(eq(templates.id, id))
    dbMs += Date.now() - updateStart

    const selectStart = Date.now()
    const [updated] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
    dbMs += Date.now() - selectStart

    return withServerTiming(success({ template: updated }), {
      auth: authMs,
      db: dbMs,
      total: Date.now() - totalStart,
    })
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
    const totalStart = Date.now()
    let authMs = 0
    let dbMs = 0

    const authStart = Date.now()
    const session = await getSession()
    authMs = Date.now() - authStart
    if (!session) {
      return withServerTiming(ApiErrors.unauthorized(), { auth: authMs, total: Date.now() - totalStart })
    }

    const { id } = await params
    const authTemplateStart = Date.now()
    const result = await getTemplateWithAuth(id, session)
    dbMs += Date.now() - authTemplateStart
    
    if (result.kind === 'error') {
      return withServerTiming(result.response, { auth: authMs, db: dbMs, total: Date.now() - totalStart })
    }

    const deleteStart = Date.now()
    await db.delete(templates).where(eq(templates.id, id))
    dbMs += Date.now() - deleteStart

    return withServerTiming(success({ deleted: true }), {
      auth: authMs,
      db: dbMs,
      total: Date.now() - totalStart,
    })
  } catch (error) {
    console.error('Error deleting template:', error)
    return ApiErrors.operationFailed('Failed to delete template')
  }
}
