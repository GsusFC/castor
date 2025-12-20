import { describe, expect, it } from 'vitest'

import type { AccountContext } from './castor-ai'
import { buildBrandContext, sanitizePromptInput } from './prompt-utils'

describe('sanitizePromptInput', () => {
  it('elimina caracteres peligrosos y controla el tamaño', () => {
    const input = '<script>alert(1)</script> text with control\u0001chars'

    const sanitized = sanitizePromptInput(input)

    expect(sanitized).toBe('scriptalert(1)/script text with controlchars')
    expect(sanitized.length).toBeLessThanOrEqual(2000)
  })

  it('recorta a 2000 caracteres', () => {
    const longInput = 'a'.repeat(2100)

    const sanitized = sanitizePromptInput(longInput)

    expect(sanitized.length).toBe(2000)
  })
})

describe('buildBrandContext', () => {
  it('construye bloques de contexto con secciones', () => {
    const context: AccountContext = {
      brandVoice: 'Inspirador y directo.',
      alwaysDo: ['Usar emojis relevantes', 'Mantener tono positivo'],
      neverDo: ['Hablar de política'],
    }

    const result = buildBrandContext(context)

    expect(result).toContain('CONTEXTO DE MARCA:')
    expect(result).toContain('VOZ DE MARCA:')
    expect(result).toContain('SIEMPRE HACER:')
    expect(result).toContain('NUNCA HACER:')
  })

  it('devuelve cadena vacía cuando no hay contexto', () => {
    expect(buildBrandContext(null)).toBe('')
    expect(buildBrandContext(undefined)).toBe('')
  })
})
