import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

// GET /api/templates?accountId=xxx - Obtener templates de una cuenta
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId es requerido' },
        { status: 400 }
      )
    }

    const accountTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.accountId, accountId))
      .orderBy(templates.createdAt)

    return NextResponse.json({ templates: accountTemplates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Error al obtener templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Crear un nuevo template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, name, content, channelId } = body

    if (!accountId || !name || !content) {
      return NextResponse.json(
        { error: 'accountId, name y content son requeridos' },
        { status: 400 }
      )
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

    return NextResponse.json({ template: newTemplate }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Error al crear template' },
      { status: 500 }
    )
  }
}
