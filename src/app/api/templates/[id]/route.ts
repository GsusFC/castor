import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/templates/[id] - Obtener un template específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    if (!template) {
      return NextResponse.json(
        { error: 'Template no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Error al obtener template' },
      { status: 500 }
    )
  }
}

// PATCH /api/templates/[id] - Actualizar un template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, content, channelId } = body

    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    if (!existing) {
      return NextResponse.json(
        { error: 'Template no encontrado' },
        { status: 404 }
      )
    }

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

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Error al actualizar template' },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Eliminar un template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [existing] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))

    if (!existing) {
      return NextResponse.json(
        { error: 'Template no encontrado' },
        { status: 404 }
      )
    }

    await db.delete(templates).where(eq(templates.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Error al eliminar template' },
      { status: 500 }
    )
  }
}
