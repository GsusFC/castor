import type { AccountContext } from './castor-ai'

export type AccountType = 'personal' | 'business'
export type VoiceModePreference = 'auto' | 'brand' | 'personal'
export type EffectiveVoiceMode = 'brand' | 'personal'

export const sanitizePromptInput = (value: string): string =>
  value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 2000)

export const resolveVoiceMode = (
  accountType: AccountType,
  preference: VoiceModePreference = 'auto'
): EffectiveVoiceMode => {
  if (preference === 'brand' || preference === 'personal') return preference
  return accountType === 'business' ? 'brand' : 'personal'
}

export const buildBrandContext = (accountContext?: AccountContext | null): string => {
  if (!accountContext) return ''

  let context = ''
  if (accountContext.brandVoice) context += `\n\nVOZ DE MARCA:\n${accountContext.brandVoice}`
  if (accountContext.bio) context += `\n\nBIO:\n${accountContext.bio}`
  if (accountContext.expertise?.length) context += `\n\nÁREAS DE EXPERTISE:\n- ${accountContext.expertise.join('\n- ')}`
  if (accountContext.alwaysDo?.length) context += `\n\nSIEMPRE HACER:\n- ${accountContext.alwaysDo.join('\n- ')}`
  if (accountContext.neverDo?.length) context += `\n\nNUNCA HACER:\n- ${accountContext.neverDo.join('\n- ')}`
  if (accountContext.hashtags?.length) context += `\n\nHASHTAGS PREFERIDOS: ${accountContext.hashtags.join(', ')}`

  return context.trim() ? `\n\nCONTEXTO DE MARCA:${context}` : ''
}
