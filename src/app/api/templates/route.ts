import { NextRequest } from 'next/server'
import { db, accounts, accountMembers } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and, exists } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getSession, canAccess } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, createTemplateSchema } from '@/lib/validations'
import { z } from 'zod'

// GET /api/templates?accountId=xxx - Obtener templates de una cuenta
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return ApiErrors.validationFailed([{ field: 'accountId', message: 'accountId is required' }])
    }

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

    if (rows.length === 0) {
      return ApiErrors.notFound('Account')
    }

    const { ownerId, isMember } = rows[0]
    if (!canAccess(session, { ownerId, isMember: Boolean(isMember) })) {
      return ApiErrors.forbidden('No access to this account')
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

    return success({ templates: accountTemplates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return ApiErrors.operationFailed('Failed to fetch templates')
  }
}

// POST /api/templates - Crear un nuevo template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const body = await request.json()
    
    // Validar input
    const validation = validate(createTemplateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { accountId, name, content, channelId } = validation.data

    // Verificar que el usuario tiene acceso a esta cuenta
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

    if (!accountAccess) {
      return ApiErrors.notFound('Account')
    }

    if (!canAccess(session, { ownerId: accountAccess.ownerId, isMember: Boolean(accountAccess.isMember) })) {
      return ApiErrors.forbidden('No access to this account')
    }

    const id = generateId()
    const now = new Date()

    await db.insert(templates).values({
      id,
      accountId,
      name,
      content,
      channelId: channelId || null,
      createdAt: now,
      updatedAt: now,
    })

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

    return success({ template: newTemplate }, 201)
  } catch (error) {
    console.error('Error creating template:', error)
    return ApiErrors.operationFailed('Failed to create template')
  }
}
