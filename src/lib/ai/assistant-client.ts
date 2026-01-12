export type AssistantApiMode = 'write' | 'improve' | 'translate'
export type AssistantUiMode = AssistantApiMode | 'propose'

type AssistantRequest = {
  mode: AssistantApiMode
  draft?: string
  replyingTo?: { text: string; author: string }
  quotingCast?: { text: string; author: string }
  targetTone?: string
  targetLanguage?: string
  isPro?: boolean
  accountId?: string
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
    isPro: input.isPro,
    accountId: input.accountId,
  }
}

export const getAssistantErrorMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback
  const record = data as { message?: string; error?: string }
  return record.message ?? record.error ?? fallback
}
