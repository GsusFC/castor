import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts, accounts, castMedia } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getSession } from '@/lib/auth'

/**
 * POST /api/casts/schedule
 * Programa un nuevo cast
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, content, scheduledAt, channelId, embeds, isDraft } = body

    // Validaciones
    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      )
    }

    // Para borradores, el contenido puede estar vacío
    if (!isDraft && (!content || content.trim().length === 0)) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      )
    }

    // Verificar cuenta para obtener límite de caracteres
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    const maxChars = account.isPremium ? 1024 : 320
    if (content && content.length > maxChars) {
      return NextResponse.json(
        { error: `content exceeds ${maxChars} characters` },
        { status: 400 }
      )
    }

    // Para programar, se requiere fecha. Para borradores, es opcional
    if (!isDraft && !scheduledAt) {
      return NextResponse.json(
        { error: 'scheduledAt is required' },
        { status: 400 }
      )
    }

    // Validar fecha solo si se proporciona y no es borrador
    let scheduledDate: Date | null = null
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt)
      if (!isDraft && scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'scheduledAt must be in the future' },
          { status: 400 }
        )
      }
    }

    if (account.signerStatus !== 'approved') {
      return NextResponse.json(
        { error: 'Account signer is not approved' },
        { status: 400 }
      )
    }

    // Obtener usuario actual
    const session = await getSession()

    // Crear el cast (borrador o programado)
    const castId = generateId()
    const newCast = {
      id: castId,
      accountId,
      content: (content || '').trim(),
      scheduledAt: scheduledDate || new Date(), // Para borradores, usar fecha actual como placeholder
      channelId: channelId || null,
      status: isDraft ? 'draft' as const : 'scheduled' as const,
      createdById: session?.userId || null,
    }

    await db.insert(scheduledCasts).values(newCast)

    // Guardar media si hay embeds
    if (embeds && Array.isArray(embeds) && embeds.length > 0) {
      const mediaValues = embeds.map((embed: { url: string }, index: number) => ({
        id: generateId(),
        castId,
        url: embed.url,
        type: embed.url.match(/\.(mp4|mov|webm)$/i) ? 'video' as const : 'image' as const,
        order: index,
      }))

      await db.insert(castMedia).values(mediaValues)
    }

    return NextResponse.json({
      success: true,
      cast: newCast,
    })
  } catch (error) {
    console.error('[API] Error scheduling cast:', error)
    return NextResponse.json(
      { error: 'Failed to schedule cast' },
      { status: 500 }
    )
  }
}
