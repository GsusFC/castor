export type AssistantApiMode = 'write' | 'improve' | 'humanize' | 'translate'
export type AssistantUiMode = AssistantApiMode | 'propose'

type AssistantRequest = {
  draft?: string
  replyingTo?: { text: string; author: string }
  quotingCast?: { text: string; author: string }
  targetTone?: string
  targetLanguage?: string
  targetPlatform?: 'farcaster' | 'x' | 'linkedin'
  maxCharsOverride?: number
  isPro?: boolean
  accountId?: string
  includeBrandValidation?: boolean
  stream?: boolean
}

export const toAssistantApiMode = (mode: AssistantUiMode): AssistantApiMode =>
  mode === 'propose' ? 'write' : mode

export const buildAssistantRequest = (input: AssistantRequest & { mode: AssistantUiMode }) => {
  const apiMode = toAssistantApiMode(input.mode)
  return {
    mode: apiMode,
    draft: apiMode === 'write' ? undefined : input.draft,
    replyingTo: input.replyingTo,
    quotingCast: input.quotingCast,
    targetTone: input.targetTone,
    targetLanguage: apiMode === 'translate' ? input.targetLanguage : undefined,
    targetPlatform: apiMode === 'improve' || apiMode === 'humanize' ? input.targetPlatform : undefined,
    maxCharsOverride: apiMode === 'improve' || apiMode === 'humanize' ? input.maxCharsOverride : undefined,
    isPro: input.isPro,
    accountId: input.accountId,
    includeBrandValidation: input.includeBrandValidation,
    stream: input.stream,
  }
}

export const getAssistantErrorMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback
  const record = data as { message?: string; error?: string }
  return record.message ?? record.error ?? fallback
}
