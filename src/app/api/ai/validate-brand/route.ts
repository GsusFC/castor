import { NextRequest, NextResponse } from 'next/server'
import { getSession, canAccess } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI } from '@/lib/ai/castor-ai'
import { brandValidator } from '@/lib/ai/brand-validator'
import { resolveVoiceMode } from '@/lib/ai/prompt-utils'

/**
 * POST /api/ai/validate-brand
 * Valida una sugerencia contra el brand voice de una cuenta
 * Usado para debugging y análisis
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suggestion, accountId } = body as {
      suggestion: string
      accountId: string
    }

    if (!suggestion?.trim()) {
      return NextResponse.json(
        { error: 'Suggestion text is required' },
        { status: 400 }
      )
    }

    if (!accountId?.trim()) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verificar acceso
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { ownerId: true, type: true, voiceMode: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
      columns: { id: true },
    })

    if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Obtener perfil del usuario
    let profile
    try {
      profile = await castorAI.getOrCreateProfile(session.userId, session.fid)
    } catch (error) {
      console.error('[BrandValidator] Profile error:', error)
      return NextResponse.json(
        { error: 'Failed to get user profile' },
        { status: 500 }
      )
    }

    // Obtener contexto de marca
    const accountContext = await castorAI.getAccountContext(accountId)
    const effectiveVoiceMode = resolveVoiceMode(
      account.type as 'personal' | 'business',
      (account.voiceMode ?? 'auto') as 'auto' | 'brand' | 'personal'
    )

    if (effectiveVoiceMode !== 'brand' || !accountContext?.brandVoice) {
      return NextResponse.json(
        {
          error: 'Brand Mode not enabled',
          message:
            effectiveVoiceMode !== 'brand'
              ? 'This account is configured to use Personal Voice'
              : 'This account does not have Brand Voice configured',
          hasBrandMode: false,
          voiceMode: effectiveVoiceMode,
        },
        { status: 400 }
      )
    }

    // Validar
    console.log('[BrandValidator] Validating suggestion...')
    const validation = await brandValidator.validate(suggestion, profile, accountContext)

    return NextResponse.json({
      validation,
      profile: {
        tone: profile.tone,
        avgLength: profile.avgLength,
        topics: profile.topics,
      },
      accountContext: {
        voiceMode: effectiveVoiceMode,
        hasBrandVoice: !!accountContext.brandVoice,
        hasAlwaysDo: !!accountContext.alwaysDo?.length,
        hasNeverDo: !!accountContext.neverDo?.length,
        expertise: accountContext.expertise,
      },
    })
  } catch (error) {
    console.error('[BrandValidator] Error:', error)
    return NextResponse.json(
      {
        error: 'VALIDATION_FAILED',
        message: 'Could not validate suggestion',
      },
      { status: 500 }
    )
  }
}
