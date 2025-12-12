import { NextRequest } from 'next/server'
import { db, accounts, accountMembers } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and, exists } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getSession, canAccess } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, createTemplateSchema } from '@/lib/validations'
import { z } from 'zod'

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

// GET /api/templates?accountId=xxx - Obtener templates de una cuenta
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return withServerTiming(ApiErrors.validationFailed([{ field: 'accountId', message: 'accountId is required' }]), {
        auth: authMs,
        total: Date.now() - totalStart,
      })
    }

    const dbStart = Date.now()
    const rows = await db
      .select({
        ownerId: accounts.ownerId,
        isMember: exists(
          db
            .select({ id: accountMembers.id })
            .from(accountMembers)
            .where(and(eq(accountMembers.userId, session.userId), eq(accountMembers.accountId, accounts.id)))
        ),
        templateId: templates.id,
        templateAccountId: templates.accountId,
        templateName: templates.name,
        templateContent: templates.content,
        templateChannelId: templates.channelId,
        templateCreatedAt: templates.createdAt,
        templateUpdatedAt: templates.updatedAt,
      })
      .from(accounts)
      .leftJoin(templates, eq(templates.accountId, accounts.id))
      .where(eq(accounts.id, accountId))
      .orderBy(templates.createdAt)
    dbMs += Date.now() - dbStart

    if (rows.length === 0) {
      return withServerTiming(ApiErrors.notFound('Account'), { auth: authMs, db: dbMs, total: Date.now() - totalStart })
    }

    const { ownerId, isMember } = rows[0]
    if (!canAccess(session, { ownerId, isMember: Boolean(isMember) })) {
      return withServerTiming(ApiErrors.forbidden('No access to this account'), {
        auth: authMs,
        db: dbMs,
        total: Date.now() - totalStart,
      })
    }

    const accountTemplates = rows
      .filter((r) => r.templateId !== null)
      .map((r) => ({
        id: r.templateId as string,
        accountId: r.templateAccountId as string,
        name: r.templateName as string,
        content: r.templateContent as string,
        channelId: r.templateChannelId as string | null,
        createdAt: r.templateCreatedAt as Date,
        updatedAt: r.templateUpdatedAt as Date,
      }))

    return withServerTiming(success({ templates: accountTemplates }), {
      auth: authMs,
      db: dbMs,
      total: Date.now() - totalStart,
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return ApiErrors.operationFailed('Failed to fetch templates')
  }
}

// POST /api/templates - Crear un nuevo template
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    
    // Validar input
    const validation = validate(createTemplateSchema, body)
    if (!validation.success) {
      return withServerTiming(validation.error, { auth: authMs, total: Date.now() - totalStart })
    }

    const { accountId, name, content, channelId } = validation.data

    // Verificar que el usuario tiene acceso a esta cuenta
    const accountAccessStart = Date.now()
    const [accountAccess] = await db
      .select({
        ownerId: accounts.ownerId,
        isMember: exists(
          db
            .select({ id: accountMembers.id })
            .from(accountMembers)
            .where(and(eq(accountMembers.userId, session.userId), eq(accountMembers.accountId, accounts.id)))
        ),
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
    dbMs += Date.now() - accountAccessStart

    if (!accountAccess) {
      return withServerTiming(ApiErrors.notFound('Account'), { auth: authMs, db: dbMs, total: Date.now() - totalStart })
    }

    if (!canAccess(session, { ownerId: accountAccess.ownerId, isMember: Boolean(accountAccess.isMember) })) {
      return withServerTiming(ApiErrors.forbidden('No access to this account'), {
        auth: authMs,
        db: dbMs,
        total: Date.now() - totalStart,
      })
    }

    const id = generateId()
    const now = new Date()

    const insertStart = Date.now()
    await db.insert(templates).values({
      id,
      accountId,
      name,
      content,
      channelId: channelId || null,
      createdAt: now,
      updatedAt: now,
    })
    dbMs += Date.now() - insertStart

    const selectStart = Date.now()
    const [newTemplate] = await db
      .select({
        id: templates.id,
        accountId: templates.accountId,
        name: templates.name,
        content: templates.content,
        channelId: templates.channelId,
        createdAt: templates.createdAt,
        updatedAt: templates.updatedAt,
      })
      .from(templates)
      .where(eq(templates.id, id))
    dbMs += Date.now() - selectStart

    return withServerTiming(success({ template: newTemplate }, 201), {
      auth: authMs,
      db: dbMs,
      total: Date.now() - totalStart,
    })
  } catch (error) {
    console.error('Error creating template:', error)
    return ApiErrors.operationFailed('Failed to create template')
  }
}
