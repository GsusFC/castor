import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
    const { 
      originalText, 
      authorUsername,
      tone = 'friendly',
      language = 'English',
      context = '',
    } = await request.json()

    if (!originalText) {
      return NextResponse.json({ error: 'originalText is required' }, { status: 400 })
    }

    const toneDesc = toneDescriptions[tone as Tone] || toneDescriptions.friendly

    const prompt = `Eres un asistente que ayuda a escribir respuestas para Farcaster (red social descentralizada similar a Twitter).

Contexto del cast original:
- Autor: @${authorUsername || 'usuario'}
- Contenido: "${originalText}"
${context ? `- Contexto adicional: ${context}` : ''}

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
