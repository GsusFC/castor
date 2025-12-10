import { describe, expect, it } from 'vitest'
import { 
  MAX_CHARS_STANDARD, 
  MAX_CHARS_PRO, 
  MAX_EMBEDS_STANDARD,
  MAX_EMBEDS_PRO,
  getMaxChars,
  getMaxEmbeds,
} from './constants'

describe('compose constants', () => {
  it('MAX_CHARS_STANDARD es 1024', () => {
    expect(MAX_CHARS_STANDARD).toBe(1024)
  })

  it('MAX_CHARS_PRO es 10000', () => {
    expect(MAX_CHARS_PRO).toBe(10000)
  })

  it('MAX_EMBEDS_STANDARD es 2', () => {
    expect(MAX_EMBEDS_STANDARD).toBe(2)
  })

  it('MAX_EMBEDS_PRO es 4', () => {
    expect(MAX_EMBEDS_PRO).toBe(4)
  })

  it('getMaxChars devuelve STANDARD para no Pro', () => {
    expect(getMaxChars(false)).toBe(1024)
  })

  it('getMaxChars devuelve PRO para Pro', () => {
    expect(getMaxChars(true)).toBe(10000)
  })

  it('getMaxEmbeds devuelve STANDARD para no Pro', () => {
    expect(getMaxEmbeds(false)).toBe(2)
  })

  it('getMaxEmbeds devuelve PRO para Pro', () => {
    expect(getMaxEmbeds(true)).toBe(4)
  })
})
