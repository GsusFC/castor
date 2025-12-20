import type { AccountContext } from './castor-ai'

export const sanitizePromptInput = (value?: string): string =>
  (value ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 2000)

export const buildBrandContext = (accountContext?: AccountContext | null): string => {
  if (!accountContext) return ''

  let context = ''
  if (accountContext.brandVoice) context += `\n\nVOZ DE MARCA:\n${accountContext.brandVoice}`
  if (accountContext.alwaysDo?.length) context += `\n\nSIEMPRE HACER:\n- ${accountContext.alwaysDo.join('\n- ')}`
  if (accountContext.neverDo?.length) context += `\n\nNUNCA HACER:\n- ${accountContext.neverDo.join('\n- ')}`

  return context.trim() ? `\n\nCONTEXTO DE MARCA:${context}` : ''
}
