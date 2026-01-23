export const SUPPORTED_AI_LANGUAGES = [
  'en', 'es', 'it', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'nl', 'ru', 'tr', 'pl', 'sv', 'da', 'fi', 'no', 'he', 'vi', 'th', 'id'
] as const

export type SupportedTargetLanguage = (typeof SUPPORTED_AI_LANGUAGES)[number]

export const assertSupportedTargetLanguage = (value: unknown): SupportedTargetLanguage => {
  if (typeof value !== 'string') {
    throw new Error('targetLanguage must be a string')
  }

  if ((SUPPORTED_AI_LANGUAGES as readonly string[]).includes(value)) {
    return value as SupportedTargetLanguage
  }

  throw new Error(`Unsupported targetLanguage: ${value}`)
}

export const toEnglishLanguageName = (lang: SupportedTargetLanguage): string => {
  switch (lang) {
    case 'en': return 'English'
    case 'es': return 'Spanish'
    case 'it': return 'Italian'
    case 'fr': return 'French'
    case 'de': return 'German'
    case 'pt': return 'Portuguese'
    case 'zh': return 'Chinese'
    case 'ja': return 'Japanese'
    case 'ko': return 'Korean'
    case 'ar': return 'Arabic'
    case 'hi': return 'Hindi'
    case 'nl': return 'Dutch'
    case 'ru': return 'Russian'
    case 'tr': return 'Turkish'
    case 'pl': return 'Polish'
    case 'sv': return 'Swedish'
    case 'da': return 'Danish'
    case 'fi': return 'Finnish'
    case 'no': return 'Norwegian'
    case 'he': return 'Hebrew'
    case 'vi': return 'Vietnamese'
    case 'th': return 'Thai'
    case 'id': return 'Indonesian'
  }
}

export const toSpanishLanguageName = (lang: SupportedTargetLanguage): string => {
  switch (lang) {
    case 'en': return 'inglés'
    case 'es': return 'español'
    case 'it': return 'italiano'
    case 'fr': return 'francés'
    case 'de': return 'alemán'
    case 'pt': return 'portugués'
    case 'zh': return 'chino'
    case 'ja': return 'japonés'
    case 'ko': return 'coreano'
    case 'ar': return 'árabe'
    case 'hi': return 'hindi'
    case 'nl': return 'neerlandés'
    case 'ru': return 'ruso'
    case 'tr': return 'turco'
    case 'pl': return 'polaco'
    case 'sv': return 'sueco'
    case 'da': return 'danés'
    case 'fi': return 'finlandés'
    case 'no': return 'noruego'
    case 'he': return 'hebreo'
    case 'vi': return 'vietnamita'
    case 'th': return 'tailandés'
    case 'id': return 'indonesio'
  }
}

export const AI_LANGUAGE_OPTIONS: ReadonlyArray<{ value: SupportedTargetLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'nl', label: 'Nederlands (Dutch)' },
  { value: 'ru', label: 'Русский (Russian)' },
  { value: 'tr', label: 'Türkçe (Turkish)' },
  { value: 'pl', label: 'Polski (Polish)' },
  { value: 'sv', label: 'Svenska (Swedish)' },
  { value: 'da', label: 'Dansk (Danish)' },
  { value: 'fi', label: 'Suomi (Finnish)' },
  { value: 'no', label: 'Norsk (Norwegian)' },
  { value: 'he', label: 'עברית (Hebrew)' },
  { value: 'vi', label: 'Tiếng Việt (Vietnamese)' },
  { value: 'th', label: 'ไทย (Thai)' },
  { value: 'id', label: 'Bahasa Indonesia (Indonesian)' },
]
