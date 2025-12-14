'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  assertSupportedTargetLanguage,
  type SupportedTargetLanguage,
} from '@/lib/ai/languages'

const STORAGE_KEY = 'castor:ai:languagePreferences'

type AiLanguagePreferencesState = {
  defaultLanguage: SupportedTargetLanguage
  enabledLanguages: SupportedTargetLanguage[]
}

type AiLanguagePreferencesContextValue = AiLanguagePreferencesState & {
  setDefaultLanguage: (lang: SupportedTargetLanguage) => void
  toggleEnabledLanguage: (lang: SupportedTargetLanguage) => void
}

const DEFAULT_STATE: AiLanguagePreferencesState = {
  defaultLanguage: 'en',
  enabledLanguages: ['en', 'es', 'it'],
}

const AiLanguagePreferencesContext = createContext<AiLanguagePreferencesContextValue | null>(null)

const normalizeState = (candidate: unknown): AiLanguagePreferencesState => {
  if (!candidate || typeof candidate !== 'object') {
    return DEFAULT_STATE
  }

  const rawDefault = (candidate as { defaultLanguage?: unknown }).defaultLanguage
  const rawEnabled = (candidate as { enabledLanguages?: unknown }).enabledLanguages

  let defaultLanguage: SupportedTargetLanguage
  try {
    defaultLanguage = assertSupportedTargetLanguage(rawDefault)
  } catch {
    defaultLanguage = DEFAULT_STATE.defaultLanguage
  }

  const enabledLanguages = Array.isArray(rawEnabled)
    ? rawEnabled
        .map((lang) => {
          try {
            return assertSupportedTargetLanguage(lang)
          } catch {
            return null
          }
        })
        .filter((lang): lang is SupportedTargetLanguage => lang !== null)
    : [...DEFAULT_STATE.enabledLanguages]

  const uniqueEnabled = Array.from(new Set(enabledLanguages))

  if (uniqueEnabled.length === 0) {
    return DEFAULT_STATE
  }

  if (!uniqueEnabled.includes(defaultLanguage)) {
    uniqueEnabled.unshift(defaultLanguage)
  }

  return {
    defaultLanguage,
    enabledLanguages: uniqueEnabled,
  }
}

export function AiLanguagePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AiLanguagePreferencesState>(DEFAULT_STATE)

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as unknown
      setState(normalizeState(parsed))
    } catch {
      setState(DEFAULT_STATE)
    }
  }, [])

  const persist = useCallback((next: AiLanguagePreferencesState) => {
    setState(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const setDefaultLanguage = useCallback(
    (lang: SupportedTargetLanguage) => {
      const enabledLanguages = state.enabledLanguages.includes(lang)
        ? state.enabledLanguages
        : [lang, ...state.enabledLanguages]

      persist({
        defaultLanguage: lang,
        enabledLanguages,
      })
    },
    [persist, state.enabledLanguages]
  )

  const toggleEnabledLanguage = useCallback(
    (lang: SupportedTargetLanguage) => {
      if (lang === state.defaultLanguage) {
        return
      }

      if (state.enabledLanguages.includes(lang)) {
        const nextEnabled = state.enabledLanguages.filter((l) => l !== lang)
        if (nextEnabled.length === 0) {
          return
        }

        persist({
          defaultLanguage: state.defaultLanguage,
          enabledLanguages: nextEnabled,
        })
        return
      }

      persist({
        defaultLanguage: state.defaultLanguage,
        enabledLanguages: [...state.enabledLanguages, lang],
      })
    },
    [persist, state.defaultLanguage, state.enabledLanguages]
  )

  const value = useMemo(
    () => ({
      defaultLanguage: state.defaultLanguage,
      enabledLanguages: state.enabledLanguages,
      setDefaultLanguage,
      toggleEnabledLanguage,
    }),
    [setDefaultLanguage, state.defaultLanguage, state.enabledLanguages, toggleEnabledLanguage]
  )

  return (
    <AiLanguagePreferencesContext.Provider value={value}>
      {children}
    </AiLanguagePreferencesContext.Provider>
  )
}

export const useAiLanguagePreferences = (): AiLanguagePreferencesContextValue => {
  const ctx = useContext(AiLanguagePreferencesContext)
  if (!ctx) {
    throw new Error('useAiLanguagePreferences must be used within a AiLanguagePreferencesProvider')
  }
  return ctx
}
