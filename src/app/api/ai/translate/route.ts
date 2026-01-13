import { NextRequest, NextResponse } from 'next/server'
import { castorAI, assertSupportedTargetLanguage, type SupportedTargetLanguage } from '@/lib/ai/castor-ai'

const TRANSLATION_CACHE_TTL_MS = 5 * 60 * 1000
const TRANSLATION_CACHE_MAX = 500
const translationCache = new Map<string, { value: string; expiresAt: number }>()

const LANGUAGE_ALIASES: Record<string, SupportedTargetLanguage> = {
  spanish: 'es',
  espanol: 'es',
  english: 'en',
  ingles: 'en',
  french: 'fr',
  frances: 'fr',
  german: 'de',
  aleman: 'de',
  italian: 'it',
  italiano: 'it',
  portuguese: 'pt',
  portugues: 'pt',
}

const normalizeTargetLanguage = (value: unknown): SupportedTargetLanguage => {
  if (typeof value !== 'string') return 'es'
  const trimmed = value.trim()
  if (!trimmed) return 'es'
  const lower = trimmed.toLowerCase()
  const alias = LANGUAGE_ALIASES[lower]
  if (alias) return alias
  try {
    return assertSupportedTargetLanguage(lower)
  } catch {
    return 'es'
  }
}

const getCachedTranslation = (key: string): string | null => {
  const cached = translationCache.get(key)
  if (!cached) return null
  if (cached.expiresAt < Date.now()) {
    translationCache.delete(key)
    return null
  }
  return cached.value
}

const setCachedTranslation = (key: string, value: string) => {
  if (translationCache.size >= TRANSLATION_CACHE_MAX) {
    translationCache.clear()
  }
  translationCache.set(key, { value, expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS })
}

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage } = (await request.json()) as {
      text?: string
      targetLanguage?: unknown
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const normalizedLanguage = normalizeTargetLanguage(targetLanguage)
    const cacheKey = `${normalizedLanguage}:${text}`
    const cached = getCachedTranslation(cacheKey)
    if (cached) {
      return NextResponse.json({ translation: cached })
    }

    const translation = await castorAI.translate(text, normalizedLanguage)
    setCachedTranslation(cacheKey, translation)

    return NextResponse.json({ translation })
  } catch (error) {
    console.error('[Translate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to translate' },
      { status: 500 }
    )
  }
}
