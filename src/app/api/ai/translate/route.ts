import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { castorAI, assertSupportedTargetLanguage, type SupportedTargetLanguage } from '@/lib/ai/castor-ai'

const TRANSLATION_CACHE_TTL_MS = 30 * 60 * 1000
const TRANSLATION_CACHE_MAX = 500
const translationCache = new Map<string, { value: string; expiresAt: number }>()
const inFlightTranslations = new Map<string, Promise<string>>()

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
  chinese: 'zh',
  chino: 'zh',
  japanese: 'ja',
  japones: 'ja',
  korean: 'ko',
  coreano: 'ko',
  arabic: 'ar',
  arabe: 'ar',
  hindi: 'hi',
  russian: 'ru',
  ruso: 'ru',
  turkish: 'tr',
  turco: 'tr',
  vietnamese: 'vi',
  vietnamita: 'vi',
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

const hashText = (text: string): string => {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
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
    const trimmedText = text.trim()
    const cacheKey = `${normalizedLanguage}:${hashText(trimmedText)}`
    const cached = getCachedTranslation(cacheKey)
    if (cached) {
      return NextResponse.json({ translation: cached })
    }

    const existing = inFlightTranslations.get(cacheKey)
    if (existing) {
      const translation = await existing
      return NextResponse.json({ translation })
    }

    const translationPromise = castorAI.translate(trimmedText, normalizedLanguage)
    inFlightTranslations.set(cacheKey, translationPromise)

    let translation: string
    try {
      translation = await translationPromise
    } finally {
      inFlightTranslations.delete(cacheKey)
    }

    setCachedTranslation(cacheKey, translation)

    return NextResponse.json({ translation })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Gemini timeout')) {
      console.warn('[Translate] Timeout:', error.message)
    }
    console.error('[Translate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to translate' },
      { status: 500 }
    )
  }
}
