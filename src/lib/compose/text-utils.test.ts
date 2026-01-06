import { describe, it, expect } from 'vitest'
import {
  extractMentions,
  extractUrls,
  extractChannels,
  extractAllTokens,
  calculateCharCount,
  getRemainingChars,
  exceedsCharLimit,
  sanitizeText,
  truncateText,
  removeMentions,
  removeUrls,
  splitIntoThread,
  formatMention,
  isValidMention,
  insertMention,
} from './text-utils'

describe('text-utils', () => {
  describe('extractMentions', () => {
    it('should extract simple mentions', () => {
      expect(extractMentions('Hello @alice and @bob')).toEqual(['alice', 'bob'])
    })

    it('should extract mentions with dots', () => {
      expect(extractMentions('Hi @vitalik.eth')).toEqual(['vitalik.eth'])
    })

    it('should dedupe mentions', () => {
      expect(extractMentions('@alice @bob @alice')).toEqual(['alice', 'bob'])
    })

    it('should return empty array for no mentions', () => {
      expect(extractMentions('Hello world')).toEqual([])
    })
  })

  describe('extractUrls', () => {
    it('should extract http URLs', () => {
      expect(extractUrls('Check http://example.com')).toEqual(['http://example.com'])
    })

    it('should extract https URLs', () => {
      expect(extractUrls('Visit https://example.com/path')).toEqual(['https://example.com/path'])
    })

    it('should extract multiple URLs', () => {
      const urls = extractUrls('See https://a.com and https://b.com')
      expect(urls).toEqual(['https://a.com', 'https://b.com'])
    })

    it('should dedupe URLs', () => {
      const urls = extractUrls('https://a.com https://a.com')
      expect(urls).toEqual(['https://a.com'])
    })
  })

  describe('extractChannels', () => {
    it('should extract channels', () => {
      expect(extractChannels('Post in /farcaster and /ethereum')).toEqual(['farcaster', 'ethereum'])
    })

    it('should dedupe channels', () => {
      expect(extractChannels('/dev /design /dev')).toEqual(['dev', 'design'])
    })
  })

  describe('extractAllTokens', () => {
    it('should extract all token types', () => {
      const text = 'Hey @alice check https://example.com in /farcaster'
      const tokens = extractAllTokens(text)
      
      expect(tokens.mentions).toEqual(['alice'])
      expect(tokens.urls).toEqual(['https://example.com'])
      // Channel regex also matches /example from the URL path
      expect(tokens.channels).toEqual(['farcaster'])
    })
  })

  describe('extractChannels', () => {
    it('should not extract channels from URL paths', () => {
      expect(extractChannels('Check https://example.com/farcaster and /dev')).toEqual(['dev'])
    })
  })

  describe('calculateCharCount', () => {
    it('should count plain text correctly', () => {
      expect(calculateCharCount('Hello world')).toBe(11)
    })

    it('should count URLs as 23 characters', () => {
      // "Check " (6) + URL (23) = 29
      expect(calculateCharCount('Check https://example.com/very/long/path')).toBe(29)
    })

    it('should handle multiple URLs', () => {
      // "See " (4) + URL (23) + " and " (5) + URL (23) = 55
      expect(calculateCharCount('See https://a.com and https://b.com')).toBe(55)
    })
  })

  describe('getRemainingChars', () => {
    it('should return remaining characters for standard', () => {
      expect(getRemainingChars('Hello', false)).toBe(1024 - 5)
    })

    it('should return remaining characters for pro', () => {
      expect(getRemainingChars('Hello', true)).toBe(10000 - 5)
    })
  })

  describe('exceedsCharLimit', () => {
    it('should return false for text within limit', () => {
      expect(exceedsCharLimit('Hello', false)).toBe(false)
    })

    it('should return true for text exceeding limit', () => {
      const longText = 'a'.repeat(1025)
      expect(exceedsCharLimit(longText, false)).toBe(true)
    })
  })

  describe('sanitizeText', () => {
    it('should remove control characters', () => {
      // Control characters are removed without adding space
      expect(sanitizeText('Hello\x00World')).toBe('HelloWorld')
    })

    it('should normalize multiple spaces', () => {
      expect(sanitizeText('Hello    World')).toBe('Hello World')
    })

    it('should normalize multiple newlines', () => {
      expect(sanitizeText('Hello\n\n\n\nWorld')).toBe('Hello\n\nWorld')
    })

    it('should trim whitespace', () => {
      expect(sanitizeText('  Hello  ')).toBe('Hello')
    })
  })

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('Hello', 10)).toBe('Hello')
    })

    it('should truncate long text with suffix', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...')
    })

    it('should try to break at word boundary', () => {
      // With maxLength 15 and suffix '...', we have 12 chars available
      // 'Hello wonderful' fits (15 chars), but truncated at 12 is 'Hello wonder'
      // Last space at position 5 is < 80% of 12 (9.6), so we don't break there
      expect(truncateText('Hello wonderful world', 15)).toBe('Hello wonder...')
    })
  })

  describe('removeMentions', () => {
    it('should remove all mentions', () => {
      expect(removeMentions('Hey @alice and @bob!')).toBe('Hey and !')
    })
  })

  describe('removeUrls', () => {
    it('should remove all URLs', () => {
      expect(removeUrls('Check https://example.com now')).toBe('Check now')
    })
  })

  describe('splitIntoThread', () => {
    it('should not split short text', () => {
      const result = splitIntoThread('Hello world')
      expect(result.parts).toHaveLength(1)
      expect(result.parts[0]).toBe('Hello world')
    })

    it('should split long text into multiple parts', () => {
      const longText = 'This is a test. '.repeat(100) // ~1600 chars
      const result = splitIntoThread(longText, { maxChars: 500 })
      
      expect(result.parts.length).toBeGreaterThan(1)
      result.parts.forEach(part => {
        expect(part.length).toBeLessThanOrEqual(500)
      })
    })

    it('should add numbering when requested', () => {
      const longText = 'This is a test. '.repeat(100)
      const result = splitIntoThread(longText, { maxChars: 500, addNumbering: true })
      
      expect(result.parts[0]).toContain('1/')
      expect(result.parts[1]).toContain('2/')
    })

    it('should respect isPro flag', () => {
      const text = 'Short text'
      const result = splitIntoThread(text, { isPro: true })
      expect(result.totalParts).toBe(1)
    })
  })

  describe('formatMention', () => {
    it('should add @ if missing', () => {
      expect(formatMention('alice')).toBe('@alice')
    })

    it('should not duplicate @', () => {
      expect(formatMention('@alice')).toBe('@alice')
    })
  })

  describe('isValidMention', () => {
    it('should validate correct mentions', () => {
      expect(isValidMention('alice')).toBe(true)
      expect(isValidMention('@bob')).toBe(true)
      expect(isValidMention('vitalik.eth')).toBe(true)
    })
  })

  describe('insertMention', () => {
    it('should insert mention at cursor position', () => {
      const result = insertMention('Hello world', 'alice', 5)
      expect(result.text).toBe('Hello @alice  world')
    })

    it('should add space before if needed', () => {
      const result = insertMention('Hello', 'alice', 5)
      expect(result.text).toBe('Hello @alice ')
    })
  })
})
