import { describe, expect, it } from 'vitest'
import { MAX_CHARS_FREE, MAX_CHARS_PREMIUM, getMaxChars } from './constants'

describe('compose constants', () => {
  it('MAX_CHARS_FREE es 320', () => {
    expect(MAX_CHARS_FREE).toBe(320)
  })

  it('MAX_CHARS_PREMIUM es 1024', () => {
    expect(MAX_CHARS_PREMIUM).toBe(1024)
  })

  it('getMaxChars devuelve FREE para no premium', () => {
    expect(getMaxChars(false)).toBe(320)
  })

  it('getMaxChars devuelve PREMIUM para premium', () => {
    expect(getMaxChars(true)).toBe(1024)
  })
})
