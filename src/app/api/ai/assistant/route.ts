import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { castorAI, AIMode, SuggestionContext } from '@/lib/ai/castor-ai'
import { getMaxChars } from '@/lib/compose/constants'

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
    } = body as {
      mode: AIMode
      draft?: string
      replyingTo?: { text: string; author: string }
      quotingCast?: { text: string; author: string }
      topic?: string
      targetTone?: string
      targetLanguage?: string
      isPro?: boolean
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

    // Construir contexto
    const context: SuggestionContext = {
      currentDraft: draft,
      replyingTo,
      quotingCast,
      topic,
      targetTone,
      targetLanguage,
    }

    // Generar sugerencias
    console.log('[AI Assistant] Generating suggestions for mode:', mode)
    let suggestions
    try {
      suggestions = await castorAI.generateSuggestions(mode, profile, context, maxChars)
      console.log('[AI Assistant] Generated', suggestions.length, 'suggestions')
    } catch (genError) {
      console.error('[AI Assistant] Generation error:', genError)
      throw genError
    }

    return NextResponse.json({
      suggestions,
      profile: {
        tone: profile.tone,
        avgLength: profile.avgLength,
        languagePreference: profile.languagePreference,
      },
    })
  } catch (error) {
    console.error('[AI Assistant] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', suggestions: [] },
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
