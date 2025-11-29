import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts, accounts, castMedia } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

/**
 * POST /api/casts/schedule
 * Programa un nuevo cast
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, content, scheduledAt, channelId, embeds } = body

    // Validaciones
    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      )
    }

    if (!content || content.trim().length === 0) {
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
    if (content.length > maxChars) {
      return NextResponse.json(
        { error: `content exceeds ${maxChars} characters` },
        { status: 400 }
      )
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { error: 'scheduledAt is required' },
        { status: 400 }
      )
    }

    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduledAt must be in the future' },
        { status: 400 }
      )
    }

    if (account.signerStatus !== 'approved') {
      return NextResponse.json(
        { error: 'Account signer is not approved' },
        { status: 400 }
      )
    }

    // Crear el cast programado
    const castId = generateId()
    const newCast = {
      id: castId,
      accountId,
      content: content.trim(),
      scheduledAt: scheduledDate,
      channelId: channelId || null,
      status: 'scheduled' as const,
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
