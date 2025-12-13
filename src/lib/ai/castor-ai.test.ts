import { describe, expect, it, vi, beforeEach } from 'vitest'

const { generateContentMock, getLastPrompt, setNextModelText } = vi.hoisted(() => {
  let lastPrompt: string | null = null
  let nextModelText: string = '{"suggestions":["one","two","three"]}'

  const generateContent = vi.fn(async (prompt: string) => {
    lastPrompt = prompt
    return {
      response: {
        text: () => nextModelText,
      },
    }
  })

  return {
    generateContentMock: generateContent,
    getLastPrompt: () => lastPrompt,
    setNextModelText: (text: string) => {
      nextModelText = text
    },
  }
})

vi.mock('@google/generative-ai', () => {
  class GoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: generateContentMock,
      }
    }
  }

  return { GoogleGenerativeAI }
})

import { castorAI } from './castor-ai'

describe('CastorAI language prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setNextModelText('{"suggestions":["one","two","three"]}')
  })

  it('uses French in write prompt when targetLanguage=fr', async () => {
    await castorAI.generateSuggestions(
      'write',
      {
        id: 'p1',
        userId: 'u1',
        fid: 1,
        tone: 'casual',
        avgLength: 150,
        commonPhrases: [],
        topics: [],
        emojiUsage: 'light',
        languagePreference: 'en',
        sampleCasts: [],
        analyzedAt: new Date(),
      },
      {
        topic: 'test',
        targetLanguage: 'fr',
      },
      320
    )

    const prompt = getLastPrompt()
    expect(prompt).toBeTypeOf('string')
    expect(prompt).toContain('Write in French.')
    expect(prompt).toContain('Return ONLY valid JSON')
  })

  it('uses German in improve prompt when targetLanguage=de', async () => {
    await castorAI.generateSuggestions(
      'improve',
      {
        id: 'p1',
        userId: 'u1',
        fid: 1,
        tone: 'casual',
        avgLength: 150,
        commonPhrases: [],
        topics: [],
        emojiUsage: 'light',
        languagePreference: 'en',
        sampleCasts: [],
        analyzedAt: new Date(),
      },
      {
        currentDraft: 'hello',
        targetLanguage: 'de',
      },
      320
    )

    const prompt = getLastPrompt()
    expect(prompt).toBeTypeOf('string')
    expect(prompt).toContain('Write improvements in German.')
    expect(prompt).toContain('Return ONLY valid JSON')
  })

  it('uses portugués in translate prompt when targetLanguage=pt', async () => {
    await castorAI.generateSuggestions(
      'translate',
      {
        id: 'p1',
        userId: 'u1',
        fid: 1,
        tone: 'casual',
        avgLength: 150,
        commonPhrases: [],
        topics: [],
        emojiUsage: 'light',
        languagePreference: 'en',
        sampleCasts: [],
        analyzedAt: new Date(),
      },
      {
        currentDraft: 'hola',
        targetLanguage: 'pt',
      },
      320
    )

    const prompt = getLastPrompt()
    expect(prompt).toBeTypeOf('string')
    expect(prompt).toContain('Traduce este texto a portugués')
    expect(prompt).toContain('Responde SOLO con JSON válido')
  })

  it('defaults write language to profile preference when targetLanguage is omitted (es)', async () => {
    await castorAI.generateSuggestions(
      'write',
      {
        id: 'p1',
        userId: 'u1',
        fid: 1,
        tone: 'casual',
        avgLength: 150,
        commonPhrases: [],
        topics: [],
        emojiUsage: 'light',
        languagePreference: 'es',
        sampleCasts: [],
        analyzedAt: new Date(),
      },
      {
        topic: 'test',
      },
      320
    )

    const prompt = getLastPrompt()
    expect(prompt).toBeTypeOf('string')
    expect(prompt).toContain('Write in Spanish.')
    expect(prompt).toContain('Return ONLY valid JSON')
  })

  it('throws when model does not return JSON', async () => {
    setNextModelText('1. one\n2. two\n3. three')

    await expect(
      castorAI.generateSuggestions(
        'write',
        {
          id: 'p1',
          userId: 'u1',
          fid: 1,
          tone: 'casual',
          avgLength: 150,
          commonPhrases: [],
          topics: [],
          emojiUsage: 'light',
          languagePreference: 'en',
          sampleCasts: [],
          analyzedAt: new Date(),
        },
        {
          topic: 'test',
          targetLanguage: 'en',
        },
        320
      )
    ).rejects.toBeInstanceOf(Error)
  })
})
