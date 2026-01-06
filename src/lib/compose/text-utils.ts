/**
 * Text utilities for compose module
 * Handles mentions, URLs, formatting, and thread splitting
 */

import {
  MENTION_RULES,
  URL_RULES,
  CHANNEL_RULES,
  getMaxChars,
} from './validation-rules'

// =============================================================================
// EXTRACTION UTILITIES
// =============================================================================

/**
 * Extract all @mentions from text
 * Returns usernames without the @ symbol
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(MENTION_RULES.pattern) || []
  return [...new Set(matches.map(m => m.slice(1)))] // Remove @ and dedupe
}

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RULES.pattern) || []
  return [...new Set(matches)]
}

/**
 * Extract all /channels from text
 * Returns channel names without the / symbol
 */
export function extractChannels(text: string): string[] {
  const textWithoutUrls = text.replace(URL_RULES.pattern, '')
  const matches = textWithoutUrls.match(CHANNEL_RULES.pattern) || []
  return [...new Set(matches.map(m => m.slice(1)))] // Remove / and dedupe
}

/**
 * Extract all special tokens from text
 */
export interface ExtractedTokens {
  mentions: string[]
  urls: string[]
  channels: string[]
}

export function extractAllTokens(text: string): ExtractedTokens {
  return {
    mentions: extractMentions(text),
    urls: extractUrls(text),
    channels: extractChannels(text),
  }
}

// =============================================================================
// CHARACTER COUNTING
// =============================================================================

/**
 * Calculate effective character count
 * URLs count as URL_RULES.charLength characters (like Twitter)
 */
export function calculateCharCount(text: string): number {
  const urls = text.match(URL_RULES.pattern) || []
  let count = text.length
  
  for (const url of urls) {
    count = count - url.length + URL_RULES.charLength
  }
  
  return count
}

/**
 * Get remaining characters before hitting the limit
 */
export function getRemainingChars(text: string, isPro = false): number {
  const maxChars = getMaxChars(isPro)
  return maxChars - calculateCharCount(text)
}

/**
 * Check if text exceeds character limit
 */
export function exceedsCharLimit(text: string, isPro = false): boolean {
  return getRemainingChars(text, isPro) < 0
}

// =============================================================================
// TEXT FORMATTING
// =============================================================================

/**
 * Sanitize text for safe usage
 * Removes control characters, normalizes whitespace
 */
export function sanitizeText(text: string): string {
  return text
    // Remove control characters except newlines and tabs
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Normalize multiple spaces to single space
    .replace(/[^\S\n]+/g, ' ')
    // Normalize multiple newlines to max 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim()
}

/**
 * Truncate text to a max length, preserving word boundaries
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text
  
  const truncateAt = maxLength - suffix.length
  const truncated = text.slice(0, truncateAt)
  
  // Try to break at word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > truncateAt * 0.8) {
    return truncated.slice(0, lastSpace) + suffix
  }
  
  return truncated + suffix
}

/**
 * Remove all mentions from text
 */
export function removeMentions(text: string): string {
  return text.replace(MENTION_RULES.pattern, '').replace(/\s+/g, ' ').trim()
}

/**
 * Remove all URLs from text
 */
export function removeUrls(text: string): string {
  return text.replace(URL_RULES.pattern, '').replace(/\s+/g, ' ').trim()
}

// =============================================================================
// THREAD SPLITTING
// =============================================================================

export interface SplitOptions {
  /** Max characters per cast */
  maxChars?: number
  /** Whether the account is Pro */
  isPro?: boolean
  /** Add thread numbering (1/N, 2/N, etc.) */
  addNumbering?: boolean
  /** Preserve paragraphs when possible */
  preserveParagraphs?: boolean
  /** Custom separator between casts (for numbering) */
  separator?: string
}

export interface SplitResult {
  parts: string[]
  totalParts: number
  /** Characters used in each part */
  charCounts: number[]
}

/**
 * Split long text into multiple casts for a thread
 */
export function splitIntoThread(text: string, options: SplitOptions = {}): SplitResult {
  const {
    maxChars,
    isPro = false,
    addNumbering = false,
    preserveParagraphs = true,
  } = options
  
  const limit = maxChars ?? getMaxChars(isPro)
  const sanitized = sanitizeText(text)
  
  // If it fits in one cast, return as-is
  if (calculateCharCount(sanitized) <= limit) {
    return {
      parts: [sanitized],
      totalParts: 1,
      charCounts: [calculateCharCount(sanitized)],
    }
  }
  
  const parts: string[] = []
  
  if (preserveParagraphs) {
    // Try to split by paragraphs first
    const paragraphs = sanitized.split(/\n\n+/)
    let currentPart = ''
    
    for (const paragraph of paragraphs) {
      const testContent = currentPart 
        ? `${currentPart}\n\n${paragraph}` 
        : paragraph
      
      if (calculateCharCount(testContent) <= limit) {
        currentPart = testContent
      } else {
        // Current part is full, save it and start new
        if (currentPart) {
          parts.push(currentPart)
        }
        
        // If single paragraph is too long, split it by sentences
        if (calculateCharCount(paragraph) > limit) {
          const sentenceParts = splitBySentences(paragraph, limit)
          parts.push(...sentenceParts.slice(0, -1))
          currentPart = sentenceParts[sentenceParts.length - 1] || ''
        } else {
          currentPart = paragraph
        }
      }
    }
    
    // Don't forget the last part
    if (currentPart) {
      parts.push(currentPart)
    }
  } else {
    // Simple split by sentences
    parts.push(...splitBySentences(sanitized, limit))
  }
  
  // Add numbering if requested
  const finalParts = addNumbering 
    ? addThreadNumbering(parts, limit)
    : parts
  
  return {
    parts: finalParts,
    totalParts: finalParts.length,
    charCounts: finalParts.map(p => calculateCharCount(p)),
  }
}

/**
 * Split text by sentences, respecting max length
 */
function splitBySentences(text: string, maxChars: number): string[] {
  // Match sentences (ending with . ! ? or newline)
  const sentencePattern = /[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g
  const sentences = text.match(sentencePattern) || [text]
  
  const parts: string[] = []
  let currentPart = ''
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    const testContent = currentPart 
      ? `${currentPart} ${trimmedSentence}` 
      : trimmedSentence
    
    if (calculateCharCount(testContent) <= maxChars) {
      currentPart = testContent
    } else {
      if (currentPart) {
        parts.push(currentPart)
      }
      
      // If single sentence is too long, split by words
      if (calculateCharCount(trimmedSentence) > maxChars) {
        const wordParts = splitByWords(trimmedSentence, maxChars)
        parts.push(...wordParts.slice(0, -1))
        currentPart = wordParts[wordParts.length - 1] || ''
      } else {
        currentPart = trimmedSentence
      }
    }
  }
  
  if (currentPart) {
    parts.push(currentPart)
  }
  
  return parts
}

/**
 * Split text by words as last resort
 */
function splitByWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const parts: string[] = []
  let currentPart = ''
  
  for (const word of words) {
    const testContent = currentPart ? `${currentPart} ${word}` : word
    
    if (calculateCharCount(testContent) <= maxChars) {
      currentPart = testContent
    } else {
      if (currentPart) {
        parts.push(currentPart)
      }
      currentPart = word
    }
  }
  
  if (currentPart) {
    parts.push(currentPart)
  }
  
  return parts
}

/**
 * Add thread numbering to parts (1/N format)
 */
function addThreadNumbering(parts: string[], maxChars: number): string[] {
  const total = parts.length
  
  return parts.map((part, index) => {
    const numbering = `${index + 1}/${total}`
    const withNumbering = `${part}\n\n${numbering}`
    
    // If adding numbering exceeds limit, truncate content
    if (calculateCharCount(withNumbering) > maxChars) {
      const availableChars = maxChars - calculateCharCount(`\n\n${numbering}`) - 3
      return `${truncateText(part, availableChars)}\n\n${numbering}`
    }
    
    return withNumbering
  })
}

// =============================================================================
// MENTION UTILITIES
// =============================================================================

/**
 * Format a username as a mention
 */
export function formatMention(username: string): string {
  const clean = username.replace(/^@/, '')
  return `@${clean}`
}

/**
 * Check if a string is a valid mention format
 */
export function isValidMention(mention: string): boolean {
  const withAt = mention.startsWith('@') ? mention : `@${mention}`
  // Create new regex instance to avoid stateful global flag issues
  const pattern = new RegExp(MENTION_RULES.pattern.source)
  return pattern.test(withAt)
}

/**
 * Insert a mention at cursor position in text
 */
export function insertMention(
  text: string, 
  username: string, 
  cursorPosition: number
): { text: string; newCursorPosition: number } {
  const mention = formatMention(username)
  const before = text.slice(0, cursorPosition)
  const after = text.slice(cursorPosition)
  
  // Add space before if needed
  const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
  // Add space after
  const spaceBefore = needsSpaceBefore ? ' ' : ''
  const spaceAfter = ' '
  
  const newText = `${before}${spaceBefore}${mention}${spaceAfter}${after}`
  const newCursor = cursorPosition + spaceBefore.length + mention.length + spaceAfter.length
  
  return {
    text: newText,
    newCursorPosition: newCursor,
  }
}
