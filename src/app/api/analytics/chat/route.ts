import { NextRequest, NextResponse } from 'next/server'
import { canAccess, getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI } from '@/lib/ai/castor-ai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireGeminiEnv } from '@/lib/env'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const buildBrandContext = (accountContext: Awaited<ReturnType<typeof castorAI.getAccountContext>>): string => {
  if (!accountContext) return ''

  let context = ''

  if (accountContext.brandVoice) {
    context += `\n\nVOZ DE MARCA:\n${accountContext.brandVoice}`
  }
  if (accountContext.bio) {
    context += `\n\nBIO:\n${accountContext.bio}`
  }
  if (accountContext.expertise?.length) {
    context += `\n\nÁREAS DE EXPERTISE:\n- ${accountContext.expertise.join('\n- ')}`
  }
  if (accountContext.alwaysDo?.length) {
    context += `\n\nSIEMPRE HACER:\n- ${accountContext.alwaysDo.join('\n- ')}`
  }
  if (accountContext.neverDo?.length) {
    context += `\n\nNUNCA HACER:\n- ${accountContext.neverDo.join('\n- ')}`
  }
  if (accountContext.hashtags?.length) {
    context += `\n\nHASHTAGS PREFERIDOS: ${accountContext.hashtags.join(', ')}`
  }

  return context.trim() ? `\n\nCONTEXTO DE MARCA:${context}` : ''
}

/**
 * POST /api/analytics/chat
 * Chat con IA sobre el análisis de rendimiento
 */
export async function POST(request: NextRequest) {
  try {
    const { GEMINI_API_KEY } = requireGeminiEnv()
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

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
    const brandContext = buildBrandContext(accountContext)

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
Sigue la voz de marca y sus reglas si están disponibles, pero prioriza precisión.
Si no tienes suficiente información para responder algo específico, dilo claramente.
Responde en español.`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const response = await result.response

    const answer = response.text().trim() || 'No pude generar una respuesta.'

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('[Analytics Chat] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to process question',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
