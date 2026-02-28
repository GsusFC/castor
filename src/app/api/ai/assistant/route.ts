import { NextRequest, NextResponse } from 'next/server'
import { getSession, canAccess } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI, AIMode, SuggestionContext, assertSupportedTargetLanguage } from '@/lib/ai/castor-ai'
import { brandValidator } from '@/lib/ai/brand-validator'
import { resolveVoiceMode } from '@/lib/ai/prompt-utils'
import { getMaxChars } from '@/lib/compose/constants'
import { nanoid } from 'nanoid'

const isInvalidAIResponseError = (error: unknown): boolean => {
  if (error instanceof SyntaxError) return true
  if (error instanceof Error && error.message.startsWith('Invalid AI response:')) return true
  return false
}

const isRateLimitError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.includes('Too Many Requests') || error.message.includes('quota')
  }
  return false
}

const BRAND_VALIDATION_TIMEOUT_MS = 4000

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * POST /api/ai/assistant
 * Endpoint unificado para el asistente de IA
 * 
 * Modos:
 * - write: La IA escribe por ti basándose en contexto
 * - improve: Mejora un borrador manteniendo tu voz
 * - humanize: Reescribe para sonar más natural manteniendo el significado
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
      targetPlatform,
      maxCharsOverride,
      isPro = false,
      accountId,
      includeBrandValidation = true,
      stream = false,
    } = body as {
      mode: AIMode
      draft?: string
      replyingTo?: { text: string; author: string }
      quotingCast?: { text: string; author: string }
      topic?: string
      targetTone?: string
      targetLanguage?: string
      targetPlatform?: 'farcaster' | 'x' | 'linkedin'
      maxCharsOverride?: number
      isPro?: boolean
      accountId?: string
      includeBrandValidation?: boolean
      stream?: boolean
    }

    if (!accountId?.trim()) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    if (!mode || !['write', 'improve', 'humanize', 'translate'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Use: write, improve, humanize, or translate' },
        { status: 400 }
      )
    }

    // Validaciones por modo
    if ((mode === 'improve' || mode === 'humanize') && !draft) {
      return NextResponse.json(
        { error: 'Draft is required for improve/humanize mode' },
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

    if (targetPlatform !== undefined && !['farcaster', 'x', 'linkedin'].includes(targetPlatform)) {
      return NextResponse.json(
        { error: 'Invalid targetPlatform. Use: farcaster, x, or linkedin' },
        { status: 400 }
      )
    }

    if (maxCharsOverride !== undefined) {
      if (!Number.isFinite(maxCharsOverride) || maxCharsOverride < 80 || maxCharsOverride > 10000) {
        return NextResponse.json(
          { error: 'Invalid maxCharsOverride. Must be between 80 and 10000' },
          { status: 400 }
        )
      }
    }

    const buildAssistantPayload = async (
      onStatus?: (status: string) => void
    ): Promise<{
      suggestions: Array<{
        id: string
        text: string
        length: number
        mode: AIMode
        targetTone: string | null
        targetLanguage: string | null
        brandValidation?: Awaited<ReturnType<typeof brandValidator.validate>>
      }>
      profile: { tone: string; avgLength: number; languagePreference: string }
      hasBrandMode: boolean
      voiceMode: 'brand' | 'personal'
    }> => {
      onStatus?.('Loading your voice profile...')

      let profile
      try {
        profile = await castorAI.getOrCreateProfile(session.userId, session.fid)
      } catch (profileError) {
        console.error('[AI Assistant] Profile error, using default:', profileError)
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

      let accountContext: SuggestionContext['accountContext']
      let isProValidated = isPro
      let effectiveVoiceMode: 'brand' | 'personal' = 'personal'

      if (accountId) {
        onStatus?.('Loading account context...')
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, accountId),
          columns: {
            ownerId: true,
            isPremium: true,
            type: true,
            voiceMode: true,
          },
        })

        if (!account) {
          throw new Error('ACCOUNT_NOT_FOUND')
        }

        isProValidated = account.isPremium
        effectiveVoiceMode = resolveVoiceMode(
          account.type as 'personal' | 'business',
          (account.voiceMode ?? 'auto') as 'auto' | 'brand' | 'personal'
        )

        const membership = await db.query.accountMembers.findFirst({
          where: and(
            eq(accountMembers.accountId, accountId),
            eq(accountMembers.userId, session.userId)
          ),
          columns: { id: true },
        })

        if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
          throw new Error('FORBIDDEN')
        }

        const ctx = await castorAI.getAccountContext(accountId)
        if (ctx) {
          accountContext =
            effectiveVoiceMode === 'brand'
              ? ctx
              : {
                  ...ctx,
                  brandVoice: undefined,
                  alwaysDo: undefined,
                  neverDo: undefined,
                  hashtags: undefined,
                }
        }
      }

      const maxChars = maxCharsOverride
        ? Math.max(80, Math.min(10000, Math.floor(maxCharsOverride)))
        : getMaxChars(isProValidated)

      const context: SuggestionContext = {
        currentDraft: draft,
        replyingTo,
        quotingCast,
        topic,
        targetTone,
        targetLanguage,
        targetPlatform,
        accountContext,
      }

      onStatus?.('Generating suggestions...')
      let suggestions
      try {
        suggestions = await castorAI.generateSuggestions(mode, profile, context, maxChars, isProValidated)
      } catch (genError) {
        if (isRateLimitError(genError)) throw new Error('AI_RATE_LIMIT')
        if (isInvalidAIResponseError(genError)) throw new Error('AI_BAD_RESPONSE')
        throw new Error('AI_GENERATION_FAILED')
      }

      const validationCache = new Map<string, Awaited<ReturnType<typeof brandValidator.validate>>>()
      const shouldValidateBrand =
        includeBrandValidation &&
        effectiveVoiceMode === 'brand' &&
        Boolean(accountContext?.brandVoice)
      if (shouldValidateBrand) onStatus?.('Validating brand consistency...')

      const suggestionObjects = await Promise.all(
        suggestions.map(async (text: string) => {
          let brandValidation = undefined

          if (shouldValidateBrand) {
            try {
              const cached = validationCache.get(text)
              if (cached) {
                brandValidation = cached
              } else {
                const validated = await withTimeout(
                  brandValidator.validate(text, profile, accountContext),
                  BRAND_VALIDATION_TIMEOUT_MS
                )
                if (validated) {
                  brandValidation = validated
                  validationCache.set(text, validated)
                }
              }
            } catch (validationError) {
              console.warn('[AI Assistant] Brand validation error, skipping:', validationError)
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

      return {
        suggestions: suggestionObjects,
        profile: {
          tone: profile.tone,
          avgLength: profile.avgLength,
          languagePreference: profile.languagePreference,
        },
        hasBrandMode: !!accountContext?.brandVoice,
        voiceMode: effectiveVoiceMode,
      }
    }

    if (!stream) {
      try {
        const payload = await buildAssistantPayload()
        return NextResponse.json(payload)
      } catch (error) {
        if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') {
          return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        }
        if (error instanceof Error && error.message === 'FORBIDDEN') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        if (error instanceof Error && error.message.includes('Invalid AI response')) {
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
        if (error instanceof Error && error.message === 'AI_GENERATION_FAILED') {
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
        throw error
      }
    }

    const encoder = new TextEncoder()
    const sendChunk = (controller: ReadableStreamDefaultController, data: unknown) => {
      controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`))
    }

    const resultStream = new ReadableStream({
      start(controller) {
        const run = async () => {
          try {
            const payload = await buildAssistantPayload((status) => {
              sendChunk(controller, { type: 'status', status })
            })
            sendChunk(controller, { type: 'result', ...payload })
          } catch (error) {
            const message =
              error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND'
                ? 'Account not found'
                : error instanceof Error && error.message === 'FORBIDDEN'
                  ? 'Forbidden'
                  : error instanceof Error && error.message === 'AI_BAD_RESPONSE'
                    ? 'La IA devolvió una respuesta inválida. Prueba a regenerar.'
                    : error instanceof Error && error.message === 'AI_RATE_LIMIT'
                      ? 'Mucho tráfico de peticiones. Por favor, espera unos segundos e inténtalo de nuevo.'
                      : 'No se pudieron generar sugerencias. Inténtalo de nuevo.'
            sendChunk(controller, { type: 'error', message })
          } finally {
            controller.close()
          }
        }
        void run()
      },
      cancel() {
        // no-op
      },
    })

    return new Response(resultStream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
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
