import { NextRequest, NextResponse } from 'next/server'
import { getSession, canAccess } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI, AIMode, SuggestionContext, assertSupportedTargetLanguage } from '@/lib/ai/castor-ai'
import { brandValidator } from '@/lib/ai/brand-validator'
import { getMaxChars } from '@/lib/compose/constants'
import { nanoid } from 'nanoid'

const isInvalidAIResponseError = (error: unknown): boolean => {
  if (error instanceof SyntaxError) return true
  if (error instanceof Error && error.message.startsWith('Invalid AI response:')) return true
  return false
}

/**
 * POST /api/ai/assistant
 * Endpoint unificado para el asistente de IA
 * 
 * Modos:
 * - write: La IA escribe por ti basándose en contexto
 * - improve: Mejora un borrador manteniendo tu voz
 * - translate: Traduce a otro idioma
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      mode,
      draft,
      replyingTo,
      quotingCast,
      topic,
      targetTone,
      targetLanguage,
      isPro = false,
      accountId,
    } = body as {
      mode: AIMode
      draft?: string
      replyingTo?: { text: string; author: string }
      quotingCast?: { text: string; author: string }
      topic?: string
      targetTone?: string
      targetLanguage?: string
      isPro?: boolean
      accountId?: string
    }

    if (!accountId?.trim()) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    if (!mode || !['write', 'improve', 'translate'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Use: write, improve, or translate' },
        { status: 400 }
      )
    }

    // Validaciones por modo
    if (mode === 'improve' && !draft) {
      return NextResponse.json(
        { error: 'Draft is required for improve mode' },
        { status: 400 }
      )
    }

    if (mode === 'translate' && !draft) {
      return NextResponse.json(
        { error: 'Text is required for translate mode' },
        { status: 400 }
      )
    }

    if (mode === 'translate' && !targetLanguage) {
      return NextResponse.json(
        { error: 'targetLanguage is required for translate mode' },
        { status: 400 }
      )
    }

    if (targetLanguage !== undefined) {
      try {
        assertSupportedTargetLanguage(targetLanguage)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Invalid targetLanguage' },
          { status: 400 }
        )
      }
    }

    // Obtener o crear perfil de estilo (con fallback)
    console.log('[AI Assistant] Getting profile for:', session.userId, session.fid)
    let profile
    try {
      profile = await castorAI.getOrCreateProfile(session.userId, session.fid)
      console.log('[AI Assistant] Profile:', profile.tone, profile.languagePreference)
    } catch (profileError) {
      console.error('[AI Assistant] Profile error, using default:', profileError)
      // Usar perfil por defecto si falla
      profile = {
        id: 'default',
        userId: session.userId,
        fid: session.fid,
        tone: 'casual' as const,
        avgLength: 150,
        commonPhrases: [],
        topics: [],
        emojiUsage: 'light' as const,
        languagePreference: 'en' as const,
        sampleCasts: [],
        analyzedAt: new Date(),
      }
    }

    // Determinar límite de caracteres
    const maxChars = getMaxChars(isPro)

    // Obtener contexto de la cuenta si se proporciona accountId
    let accountContext: SuggestionContext['accountContext']
    if (accountId) {
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        columns: {
          ownerId: true,
        },
      })

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

      const membership = await db.query.accountMembers.findFirst({
        where: and(
          eq(accountMembers.accountId, accountId),
          eq(accountMembers.userId, session.userId)
        ),
        columns: {
          id: true,
        },
      })

      if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      console.log('[AI Assistant] Getting account context for:', accountId)
      const ctx = await castorAI.getAccountContext(accountId)
      if (ctx) {
        accountContext = ctx
        console.log('[AI Assistant] Account context loaded:', {
          hasBrandVoice: !!accountContext.brandVoice,
          hasAlwaysDo: !!accountContext.alwaysDo?.length,
          hasNeverDo: !!accountContext.neverDo?.length,
        })
      }
    }

    // Construir contexto
    const context: SuggestionContext = {
      currentDraft: draft,
      replyingTo,
      quotingCast,
      topic,
      targetTone,
      targetLanguage,
      accountContext,
    }

    // Generar sugerencias
    console.log('[AI Assistant] Generating suggestions for mode:', mode)
    let suggestions
    try {
      suggestions = await castorAI.generateSuggestions(mode, profile, context, maxChars)
      console.log('[AI Assistant] Generated', suggestions.length, 'suggestions')
    } catch (genError) {
      console.error('[AI Assistant] Generation error:', genError)
      if (isInvalidAIResponseError(genError)) {
        return NextResponse.json(
          {
            error: 'AI_BAD_RESPONSE',
            code: 'AI_BAD_RESPONSE',
            message: 'La IA devolvió una respuesta inválida. Prueba a regenerar.',
            suggestions: [],
          },
          { status: 502 }
        )
      }

      return NextResponse.json(
        {
          error: 'AI_GENERATION_FAILED',
          code: 'AI_GENERATION_FAILED',
          message: 'No se pudieron generar sugerencias. Inténtalo de nuevo.',
          suggestions: [],
        },
        { status: 500 }
      )
    }

    // Validar coherencia de marca para cada sugerencia
    const suggestionObjects = await Promise.all(
      suggestions.map(async (text: string) => {
        let brandValidation = undefined

        // Validar solo si hay contexto de marca (Brand Mode ON)
        if (accountContext?.brandVoice) {
          try {
            brandValidation = await brandValidator.validate(text, profile, accountContext)
          } catch (validationError) {
            console.warn('[AI Assistant] Brand validation error, skipping:', validationError)
            // Si falla la validación, continuar sin ella
          }
        }

        return {
          id: nanoid(),
          text,
          length: text.length,
          mode,
          targetTone: targetTone ?? null,
          targetLanguage: targetLanguage ?? null,
          brandValidation,
        }
      })
    )

    return NextResponse.json({
      suggestions: suggestionObjects,
      profile: {
        tone: profile.tone,
        avgLength: profile.avgLength,
        languagePreference: profile.languagePreference,
      },
      hasBrandMode: !!accountContext?.brandVoice,
    })
  } catch (error) {
    console.error('[AI Assistant] Error:', error)
    return NextResponse.json(
      {
        error: 'AI_INTERNAL_ERROR',
        code: 'AI_INTERNAL_ERROR',
        message: 'No se pudieron generar sugerencias. Inténtalo de nuevo.',
        suggestions: [],
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ai/assistant
 * Refrescar el perfil de estilo del usuario
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Re-analizar perfil
    const profile = await castorAI.analyzeAndSaveProfile(session.userId, session.fid)

    return NextResponse.json({
      message: 'Profile refreshed',
      profile: {
        tone: profile.tone,
        avgLength: profile.avgLength,
        topics: profile.topics,
        languagePreference: profile.languagePreference,
      },
    })
  } catch (error) {
    console.error('[AI Assistant] Error refreshing profile:', error)
    return NextResponse.json(
      { error: 'Failed to refresh profile' },
      { status: 500 }
    )
  }
}
