import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage = 'Spanish' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const prompt = `Traduce el siguiente texto de una red social (Farcaster) al ${targetLanguage}.
Mantén el tono y estilo del autor original.
Si hay jerga crypto/tech o emojis, mantén los términos originales cuando sea apropiado.
Solo devuelve la traducción, sin explicaciones adicionales.

Texto original:
"${text}"

Traducción:`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const translation = response.text?.trim() || ''

    return NextResponse.json({ translation })
  } catch (error) {
    console.error('[AI Translate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to translate' },
      { status: 500 }
    )
  }
}
