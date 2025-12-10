import { NextRequest, NextResponse } from 'next/server'
import { translate } from '@vitalets/google-translate-api'

// Mapeo de nombres de idiomas a códigos ISO
const languageMap: Record<string, string> = {
  'Spanish': 'es',
  'English': 'en',
  'French': 'fr',
  'German': 'de',
  'Italian': 'it',
  'Portuguese': 'pt',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Chinese': 'zh',
  'Russian': 'ru',
  'Arabic': 'ar',
}

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage = 'Spanish' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    // Convertir nombre de idioma a código ISO
    const langCode = languageMap[targetLanguage] || 'es'

    const result = await translate(text, { to: langCode })
    const translation = result.text || ''

    return NextResponse.json({ translation })
  } catch (error) {
    console.error('[Translate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to translate' },
      { status: 500 }
    )
  }
}
