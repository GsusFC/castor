import { env } from '@/lib/env'

export const GEMINI_MODELS = {
  default: env.GEMINI_MODEL_DEFAULT ?? 'gemini-3.1-flash',
  pro: env.GEMINI_MODEL_PRO ?? 'gemini-3.1-pro',
  fallback: env.GEMINI_MODEL_FALLBACK ?? 'gemini-3.1-flash-lite',
  reply: env.GEMINI_MODEL_REPLY ?? 'gemini-3.1-flash',
  translation: env.GEMINI_MODEL_TRANSLATION ?? 'gemini-3.1-flash',
  brandValidation: env.GEMINI_MODEL_BRAND_VALIDATION ?? 'gemini-3.1-flash',
  analytics: env.GEMINI_MODEL_ANALYTICS ?? 'gemini-3.1-flash-lite',
  styleProfile: env.GEMINI_MODEL_STYLE_PROFILE ?? 'gemini-3.1-flash',
} as const

export const GEMINI_TIMEOUT_MS = Number(env.GEMINI_TIMEOUT_MS ?? 15000)
