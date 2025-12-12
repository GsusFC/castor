import { NextRequest } from 'next/server'
import { db, accounts, accountMembers } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
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

    // Verificar que el usuario tiene acceso a esta cuenta
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return ApiErrors.notFound('Account')
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return ApiErrors.forbidden('No access to this account')
    }

    const accountTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.accountId, accountId))
      .orderBy(templates.createdAt)

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
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return ApiErrors.notFound('Account')
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
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
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    return success({ template: newTemplate }, 201)
  } catch (error) {
    console.error('Error creating template:', error)
    return ApiErrors.operationFailed('Failed to create template')
  }
}
