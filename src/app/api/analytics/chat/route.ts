import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      question, 
      insights, 
      stats, 
      topCasts,
      history = [] 
    } = body as {
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

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

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

${conversationHistory ? `Historial de la conversación:\n${conversationHistory}\n` : ''}

Pregunta del usuario: ${question}

Responde de forma concisa, útil y accionable. Si no tienes suficiente información para responder algo específico, dilo claramente. Responde en español.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const answer = response.text?.trim() || 'No pude generar una respuesta.'

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('[Analytics Chat] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to process question',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
