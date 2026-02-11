import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, accountKnowledgeBase, accountMembers } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Verificar permisos
    const isOwner = account.ownerId === session.userId
    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    const canEdit = isOwner || membership?.canEditContext || membership?.role === 'admin'

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      brandVoice,
      bio,
      expertise,
      alwaysDo,
      neverDo,
      hashtags,
      defaultTone,
      defaultLanguage,
      voiceMode,
    } = body

    if (voiceMode !== undefined && !['auto', 'brand', 'personal'].includes(voiceMode)) {
      return NextResponse.json({ error: 'Invalid voiceMode' }, { status: 400 })
    }

    if (voiceMode !== undefined) {
      await db
        .update(accounts)
        .set({
          voiceMode,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId))
    }

    // Buscar knowledge base existente
    const existing = await db.query.accountKnowledgeBase.findFirst({
      where: eq(accountKnowledgeBase.accountId, accountId),
    })

    if (existing) {
      // Actualizar
      await db
        .update(accountKnowledgeBase)
        .set({
          brandVoice,
          bio,
          expertise: JSON.stringify(expertise),
          alwaysDo: JSON.stringify(alwaysDo),
          neverDo: JSON.stringify(neverDo),
          hashtags: JSON.stringify(hashtags),
          defaultTone,
          defaultLanguage,
          updatedAt: new Date(),
          updatedById: session.userId,
        })
        .where(eq(accountKnowledgeBase.id, existing.id))
    } else {
      // Crear nuevo
      await db.insert(accountKnowledgeBase).values({
        id: nanoid(),
        accountId,
        brandVoice,
        bio,
        expertise: JSON.stringify(expertise),
        alwaysDo: JSON.stringify(alwaysDo),
        neverDo: JSON.stringify(neverDo),
        hashtags: JSON.stringify(hashtags),
        defaultTone,
        defaultLanguage,
        updatedById: session.userId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating account context:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Verificar permisos de lectura
    const isOwner = account.ownerId === session.userId
    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (!isOwner && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Obtener knowledge base
    const knowledgeBase = await db.query.accountKnowledgeBase.findFirst({
      where: eq(accountKnowledgeBase.accountId, accountId),
    })

    return NextResponse.json({ knowledgeBase })
  } catch (error) {
    console.error('Error getting account context:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
