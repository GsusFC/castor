import { NextRequest, NextResponse } from 'next/server'
import { canAccess, getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI } from '@/lib/ai/castor-ai'
import { requireGeminiEnv } from '@/lib/env'
import { GEMINI_MODELS } from '@/lib/ai/gemini-config'
import { generateGeminiText } from '@/lib/ai/gemini-helpers'
import { buildBrandContext, resolveVoiceMode } from '@/lib/ai/prompt-utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * POST /api/analytics/chat
 * Chat con IA sobre el análisis de rendimiento
 */
export async function POST(request: NextRequest) {
  try {
    requireGeminiEnv()

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      accountId,
      question, 
      insights, 
      stats, 
      topCasts,
      history = [] 
    } = body as {
      accountId: string
      question: string
      insights: {
        summary?: string
        bestHours?: string[]
        bestDays?: string[]
        recommendations?: string[]
      }
      stats: {
        totalCasts: number
        avgEngagement: number
      }
      topCasts?: Array<{
        content: string
        likes: number
        recasts: number
        replies: number
      }>
      history?: ChatMessage[]
    }

    if (!accountId?.trim()) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

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

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

    const accountContext = await castorAI.getAccountContext(accountId)
    const effectiveVoiceMode = resolveVoiceMode(
      account.type as 'personal' | 'business',
      (account.voiceMode ?? 'auto') as 'auto' | 'brand' | 'personal'
    )
    const brandContext = effectiveVoiceMode === 'brand' ? buildBrandContext(accountContext) : ''
    const voiceInstruction =
      effectiveVoiceMode === 'brand'
        ? 'Sigue la voz de marca y sus reglas si están disponibles, pero prioriza precisión.'
        : 'No impongas voz de marca: responde claro, útil y accionable.'

    // Construir contexto del análisis
    const analysisContext = `
ANÁLISIS DE RENDIMIENTO DE FARCASTER:

Estadísticas generales:
- Total de casts analizados: ${stats.totalCasts}
- Engagement promedio: ${stats.avgEngagement}

Insights previos:
- Resumen: ${insights.summary || 'No disponible'}
- Mejores horas: ${insights.bestHours?.join(', ') || 'No disponible'}
- Mejores días: ${insights.bestDays?.join(', ') || 'No disponible'}
- Recomendaciones: ${insights.recommendations?.join('; ') || 'No disponible'}

${topCasts?.length ? `Top 5 casts por engagement:
${topCasts.slice(0, 5).map((c, i) => `${i + 1}. "${c.content?.slice(0, 100)}..." - ${c.likes} likes, ${c.recasts} recasts, ${c.replies} replies`).join('\n')}` : ''}
`

    // Construir historial de conversación
    const conversationHistory = history.map(msg => 
      `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
    ).join('\n')

    const prompt = `Eres un experto en analytics de redes sociales, específicamente Farcaster (red social crypto).
El usuario te ha preguntado sobre su rendimiento basándose en el siguiente análisis:

${analysisContext}

${brandContext}

${conversationHistory ? `Historial de la conversación:\n${conversationHistory}\n` : ''}

Pregunta del usuario: ${question}

Responde de forma concisa, útil y accionable.
${voiceInstruction}
Si no tienes suficiente información para responder algo específico, dilo claramente.
Responde en español.`

    const answer = (await generateGeminiText({
      modelId: GEMINI_MODELS.analytics,
      fallbackModelId: GEMINI_MODELS.fallback,
      prompt,
    })) || 'No pude generar una respuesta.'

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('[Analytics Chat] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to process question',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
