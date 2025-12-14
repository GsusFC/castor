export const SUPPORTED_AI_LANGUAGES = ['en', 'es', 'it', 'fr', 'de', 'pt'] as const

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
    case 'en':
      return 'English'
    case 'es':
      return 'Spanish'
    case 'it':
      return 'Italian'
    case 'fr':
      return 'French'
    case 'de':
      return 'German'
    case 'pt':
      return 'Portuguese'
  }
}

export const toSpanishLanguageName = (lang: SupportedTargetLanguage): string => {
  switch (lang) {
    case 'en':
      return 'inglés'
    case 'es':
      return 'español'
    case 'it':
      return 'italiano'
    case 'fr':
      return 'francés'
    case 'de':
      return 'alemán'
    case 'pt':
      return 'portugués'
  }
}

export const AI_LANGUAGE_OPTIONS: ReadonlyArray<{ value: SupportedTargetLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
]
