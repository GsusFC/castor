import { NextRequest, NextResponse } from 'next/server'
import { GEMINI_MODELS } from '@/lib/ai/gemini-config'
import { generateGeminiText } from '@/lib/ai/gemini-helpers'
import { canAccess, getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI } from '@/lib/ai/castor-ai'
import { buildBrandContext, resolveVoiceMode, sanitizePromptInput } from '@/lib/ai/prompt-utils'
import { requireGeminiEnv } from '@/lib/env'
import { aiReplySchema, validate } from '@/lib/validations'

type Tone = 'professional' | 'casual' | 'friendly' | 'witty' | 'controversial'

const toneDescriptions: Record<Tone, string> = {
  professional: 'profesional y respetuoso',
  casual: 'casual y relajado',
  friendly: 'amigable y cercano',
  witty: 'ingenioso y con humor',
  controversial: 'polémico y provocador, que genere debate',
}

export async function POST(request: NextRequest) {
  try {
    requireGeminiEnv()

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsedBody = validate(aiReplySchema, await request.json())
    if (!parsedBody.success) return parsedBody.error

    const { accountId, originalText, authorUsername, tone, language, context } = parsedBody.data

    const safeOriginalText = sanitizePromptInput(originalText)
    const safeAuthor = sanitizePromptInput(authorUsername)
    const safeContext = sanitizePromptInput(context)

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: {
        ownerId: true,
        type: true,
        voiceMode: true,
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, session.userId)),
      columns: {
        id: true,
      },
    })

    if (!canAccess(session, { ownerId: account.ownerId, isMember: !!membership })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const toneDesc = toneDescriptions[tone as Tone] || toneDescriptions.friendly
    const effectiveVoiceMode = resolveVoiceMode(
      account.type as 'personal' | 'business',
      (account.voiceMode ?? 'auto') as 'auto' | 'brand' | 'personal'
    )

    const accountContext = await castorAI.getAccountContext(accountId)
    const brandContext = effectiveVoiceMode === 'brand' ? buildBrandContext(accountContext) : ''

    const prompt = `Eres un asistente que ayuda a escribir respuestas para Farcaster (red social descentralizada similar a Twitter).

Contexto del cast original:
- Autor: @${safeAuthor || 'usuario'}
- Contenido: "${safeOriginalText}"
${safeContext ? `- Contexto adicional: ${safeContext}` : ''}

${brandContext}

Genera 3 sugerencias de respuesta diferentes en ${language}.
El tono debe ser ${toneDesc}.
Las respuestas deben ser concisas (máximo 280 caracteres cada una).
Deben ser relevantes al contenido original y fomentar la conversación.

Devuelve SOLO un JSON con el siguiente formato (sin markdown, sin explicaciones):
{
  "suggestions": [
    "Primera sugerencia de respuesta",
    "Segunda sugerencia de respuesta",
    "Tercera sugerencia de respuesta"
  ],
  "detectedTopic": "tema principal detectado",
  "detectedTone": "tono del autor original"
}`

    const responseText = await generateGeminiText({
      modelId: GEMINI_MODELS.reply,
      fallbackModelId: GEMINI_MODELS.fallback,
      prompt,
    }) || '{}'

    // Limpiar posibles marcadores de código
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    try {
      const parsed = JSON.parse(cleanJson)
      return NextResponse.json(parsed)
    } catch (parseError) {
      console.warn('[AI Reply] Invalid JSON from Gemini', { responseText, cleanJson, parseError })
      return NextResponse.json(
        {
          error: 'Invalid AI response format',
          suggestions: [],
        },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('[AI Reply] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate suggestions',
        suggestions: [],
      },
      { status: 500 }
    )
  }
}
