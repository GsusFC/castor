import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { canAccess, getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { castorAI } from '@/lib/ai/castor-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

type Tone = 'professional' | 'casual' | 'friendly' | 'witty' | 'controversial'

const toneDescriptions: Record<Tone, string> = {
  professional: 'profesional y respetuoso',
  casual: 'casual y relajado',
  friendly: 'amigable y cercano',
  witty: 'ingenioso y con humor',
  controversial: 'polémico y provocador, que genere debate',
}

const buildBrandContext = (accountContext: Awaited<ReturnType<typeof castorAI.getAccountContext>>): string => {
  if (!accountContext) return ''

  let context = ''
  if (accountContext.brandVoice) context += `\n\nVOZ DE MARCA:\n${accountContext.brandVoice}`
  if (accountContext.alwaysDo?.length) context += `\n\nSIEMPRE HACER:\n- ${accountContext.alwaysDo.join('\n- ')}`
  if (accountContext.neverDo?.length) context += `\n\nNUNCA HACER:\n- ${accountContext.neverDo.join('\n- ')}`

  return context.trim() ? `\n\nCONTEXTO DE MARCA:${context}` : ''
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      accountId,
      originalText, 
      authorUsername,
      tone = 'friendly',
      language = 'English',
      context = '',
    } = await request.json()

    if (!accountId?.trim()) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    if (!originalText) {
      return NextResponse.json({ error: 'originalText is required' }, { status: 400 })
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

    const toneDesc = toneDescriptions[tone as Tone] || toneDescriptions.friendly

    const accountContext = await castorAI.getAccountContext(accountId)
    const brandContext = buildBrandContext(accountContext)

    const prompt = `Eres un asistente que ayuda a escribir respuestas para Farcaster (red social descentralizada similar a Twitter).

Contexto del cast original:
- Autor: @${authorUsername || 'usuario'}
- Contenido: "${originalText}"
${context ? `- Contexto adicional: ${context}` : ''}

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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const generation = await model.generateContent(prompt)
    const response = await generation.response

    const responseText = response.text().trim() || '{}'
    
    // Limpiar posibles marcadores de código
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleanJson)

    return NextResponse.json(parsed)
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
