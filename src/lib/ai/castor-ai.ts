import { GoogleGenerativeAI } from '@google/generative-ai'
import { neynar } from '@/lib/farcaster/client'
import { db, userStyleProfiles, accountKnowledgeBase } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  assertSupportedTargetLanguage,
  toEnglishLanguageName,
  toSpanishLanguageName,
  type SupportedTargetLanguage,
} from './languages'
import { env, requireGeminiEnv, requireNeynarEnv } from '@/lib/env'
import { GEMINI_MODELS } from '@/lib/ai/gemini-config'
import { generateGeminiText } from '@/lib/ai/gemini-helpers'

export { assertSupportedTargetLanguage, toEnglishLanguageName, toSpanishLanguageName }
export type { SupportedTargetLanguage }

// Initialize Google AI with the stable SDK
// Configuración según entorno
const AI_CONFIG = {
  model: GEMINI_MODELS.default, // Modelo estándar de alta velocidad
  proModel: GEMINI_MODELS.pro, // Modelo de alto razonamiento para Pro/Análisis
  translationModel: GEMINI_MODELS.translation, // Modelo especializado en traducción
  analysisPromptSize: env.NODE_ENV === 'production' ? 50 : 30, // Aumentado para mejor análisis
  cacheProfileDays: env.NODE_ENV === 'production' ? 7 : 30,
}

const resolveWritingLanguage = (
  targetLanguage: unknown,
  profileLanguagePreference: StyleProfile['languagePreference']
): SupportedTargetLanguage => {
  if (targetLanguage !== undefined) {
    return assertSupportedTargetLanguage(targetLanguage)
  }

  if (profileLanguagePreference !== 'mixed') {
    return profileLanguagePreference
  }

  return 'en'
}

// Types
export interface StyleProfile {
  id: string
  userId: string
  fid: number
  tone: 'casual' | 'formal' | 'technical' | 'humorous' | 'mixed'
  avgLength: number
  commonPhrases: string[]
  topics: string[]
  emojiUsage: 'none' | 'light' | 'heavy'
  languagePreference: 'en' | 'es' | 'mixed'
  sampleCasts: string[]
  analyzedAt: Date
  engagementInsights?: { topic: string; scores: number[] }[]
}

export interface AccountContext {
  brandVoice?: string
  bio?: string
  expertise?: string[]
  alwaysDo?: string[]
  neverDo?: string[]
  hashtags?: string[]
  defaultTone?: string
  defaultLanguage?: string
}

export interface SuggestionContext {
  replyingTo?: {
    text: string
    author: string
  }
  quotingCast?: {
    text: string
    author: string
  }
  currentDraft?: string
  conversationContext?: string[]
  topic?: string
  targetTone?: string
  targetLanguage?: string
  accountContext?: AccountContext
}

export type AIMode = 'write' | 'improve' | 'translate'

export class CastorAI {
  constructor() {
  }

  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
  private proModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
  private accountContextCache = new Map<string, { value: AccountContext | null; expiresAt: number }>()

  private getModel() {
    if (this.model) return this.model
    const { GEMINI_API_KEY } = requireGeminiEnv()
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    this.model = genAI.getGenerativeModel({ model: AI_CONFIG.model })
    return this.model
  }

  private getProModel() {
    if (this.proModel) return this.proModel
    const { GEMINI_API_KEY } = requireGeminiEnv()
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    this.proModel = genAI.getGenerativeModel({ model: AI_CONFIG.proModel })
    return this.proModel
  }

  /**
   * Genera contenido usando el modelo configurado
   */
  private async generate(prompt: string, options?: { isTranslation?: boolean; usePro?: boolean }): Promise<string> {
    try {
      if (options?.isTranslation) {
        return await generateGeminiText({
          modelId: AI_CONFIG.translationModel,
          fallbackModelId: GEMINI_MODELS.fallback,
          prompt,
          generationConfig: {
            temperature: 0.1,
            topP: 0.9,
            maxOutputTokens: 8192,
            responseMimeType: 'text/plain',
          },
          systemInstruction:
            'You are a professional translator engine. You receive text and return ONLY the translation. Do not include explanations, intro text, or markdown formatting unless requested. Preserve original formatting.',
        })
      } else if (options?.usePro) {
        const model = this.getProModel()
        const result = await model.generateContent(prompt)
        const response = await result.response
        return response.text().trim()
      } else {
        const model = this.getModel()
        const result = await model.generateContent(prompt)
        const response = await result.response
        return response.text().trim()
      }
    } catch (error) {
      console.error('Gemini generation error:', error)
      throw error
    }
  }

  /**
   * Obtiene o crea el perfil de estilo del usuario
   */
  async getOrCreateProfile(userId: string, fid: number): Promise<StyleProfile> {
    // Buscar perfil existente
    const existing = await db.query.userStyleProfiles.findFirst({
      where: eq(userStyleProfiles.userId, userId),
    })

    if (existing) {
      // Verificar si necesita actualización (más de 7 días)
      const daysSinceAnalysis = (Date.now() - existing.analyzedAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysSinceAnalysis < AI_CONFIG.cacheProfileDays) {
        return this.dbProfileToStyleProfile(existing)
      }
    }

    // Analizar y guardar nuevo perfil
    return this.analyzeAndSaveProfile(userId, fid)
  }

  /**
   * Analiza el estilo del usuario desde sus casts
   */
  async analyzeAndSaveProfile(userId: string, fid: number): Promise<StyleProfile> {
    try {
      const { NEYNAR_API_KEY } = requireNeynarEnv()
      // Obtener casts del usuario desde Neynar
      // Obtener casts del usuario desde Neynar
      const castsResponse = await neynar.fetchFeed({
        feedType: 'filter',
        filterType: 'fids',
        fids: fid.toString(),
        limit: 25,
        withRecasts: true, // Incluir recasts para tener más contexto
      })

      const casts = castsResponse.casts || []


      const castTexts = casts
        .map((c: { text: string }) => c.text)
        .filter((t: string) => t.length > 10)

      if (castTexts.length < 5) {
        // Si no hay suficientes casts, crear perfil por defecto
        return this.createDefaultProfile(userId, fid)
      }

      // Analyze style with AI
      const analysisPrompt = `
Analyze the writing style and patterns of this Farcaster user based on their casts:

${castTexts.slice(0, AI_CONFIG.analysisPromptSize).map((text: string, i: number) => `${i + 1}. "${text}"`).join('\n')}

Respond ONLY with valid JSON (no markdown):
{
  "tone": "casual|formal|technical|humorous|mixed",
  "avgLength": <average number of characters, calculate from sample>,
  "commonPhrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],
  "topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "emojiUsage": "none|light|heavy",
  "languagePreference": "en|es|mixed",
  "powerPhrases": ["engaging_phrase1", "engaging_phrase2"],
  "contentPatterns": "describe dominant content patterns (e.g., 'shares insights with examples', 'asks questions', 'uses humor')"
}`

      const resultText = await this.generate(analysisPrompt, { usePro: true })
      const analysisText = resultText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const analysis = JSON.parse(analysisText)

      // Guardar en DB
      const profileId = nanoid()
      const now = new Date()

      await db
        .insert(userStyleProfiles)
        .values({
          id: profileId,
          userId,
          fid,
          tone: analysis.tone || 'casual',
          avgLength: analysis.avgLength || 150,
          commonPhrases: JSON.stringify(analysis.commonPhrases || []),
          topics: JSON.stringify(analysis.topics || []),
          emojiUsage: analysis.emojiUsage || 'light',
          languagePreference: analysis.languagePreference || 'en',
          sampleCasts: JSON.stringify(castTexts.slice(0, 20)),
          analyzedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userStyleProfiles.userId,
          set: {
            tone: analysis.tone || 'casual',
            avgLength: analysis.avgLength || 150,
            commonPhrases: JSON.stringify(analysis.commonPhrases || []),
            topics: JSON.stringify(analysis.topics || []),
            emojiUsage: analysis.emojiUsage || 'light',
            languagePreference: analysis.languagePreference || 'en',
            sampleCasts: JSON.stringify(castTexts.slice(0, 20)),
            analyzedAt: now,
            updatedAt: now,
          },
        })

      return {
        id: profileId,
        userId,
        fid,
        tone: analysis.tone,
        avgLength: analysis.avgLength,
        commonPhrases: analysis.commonPhrases || [],
        topics: analysis.topics || [],
        emojiUsage: analysis.emojiUsage,
        languagePreference: analysis.languagePreference,
        sampleCasts: castTexts.slice(0, 20),
        analyzedAt: now,
      }
    } catch (error) {
      console.error('Error analyzing user style:', error)
      return this.createDefaultProfile(userId, fid)
    }
  }

  /**
   * Obtiene el knowledge base de una cuenta
   */
  async getAccountContext(accountId: string): Promise<AccountContext | null> {
    try {
      const cached = this.accountContextCache.get(accountId)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value
      }

      const kb = await db.query.accountKnowledgeBase.findFirst({
        where: eq(accountKnowledgeBase.accountId, accountId),
      })

      if (!kb) {
        this.accountContextCache.set(accountId, {
          value: null,
          expiresAt: Date.now() + 5 * 60 * 1000,
        })
        return null
      }

      const value: AccountContext = {
        brandVoice: kb.brandVoice || undefined,
        bio: kb.bio || undefined,
        expertise: kb.expertise ? JSON.parse(kb.expertise) : undefined,
        alwaysDo: kb.alwaysDo ? JSON.parse(kb.alwaysDo) : undefined,
        neverDo: kb.neverDo ? JSON.parse(kb.neverDo) : undefined,
        hashtags: kb.hashtags ? JSON.parse(kb.hashtags) : undefined,
        defaultTone: kb.defaultTone || undefined,
        defaultLanguage: kb.defaultLanguage || undefined,
      }
      this.accountContextCache.set(accountId, {
        value,
        expiresAt: Date.now() + 5 * 60 * 1000,
      })
      return value
    } catch (error) {
      console.error('Error getting account context:', error)
      return null
    }
  }

  /**
   * Genera sugerencias según el modo
   */
  async generateSuggestions(
    mode: AIMode,
    profile: StyleProfile,
    context: SuggestionContext,
    maxChars: number = 320,
    isProUser: boolean = false
  ): Promise<string[]> {
    const systemContext = this.buildSystemContext(profile, maxChars, context.accountContext)
    let userPrompt: string

    switch (mode) {
      case 'write':
        userPrompt = this.buildWritePrompt(context, maxChars, profile.languagePreference)
        break
      case 'improve':
        userPrompt = this.buildImprovePrompt(context, maxChars, profile.languagePreference)
        break
      case 'translate':
        userPrompt = this.buildTranslatePrompt(context)
        break
      default:
        throw new Error(`Invalid mode: ${mode}`)
    }

    const fullPrompt = `${systemContext}\n\n---\n\n${userPrompt}`
    const resultText = await this.generate(fullPrompt, {
      isTranslation: mode === 'translate',
      usePro: isProUser || mode === 'improve' // Force Pro for improvements or Pro users
    })
    // Translations can expand beyond maxChars — don't discard them
    const parseLimit = mode === 'translate' ? Math.max(maxChars, 10000) : maxChars
    return this.parseSuggestions(resultText, parseLimit)
  }

  /**
   * Translate text to another language
   */
  async translate(text: string, targetLanguage: string): Promise<string> {
    const lang = assertSupportedTargetLanguage(targetLanguage)
    const langName = toEnglishLanguageName(lang)
    const sanitize = (value: string) => value.trim().replace(/^["']|["']$/g, '')
    const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length
    const sentenceCount = (value: string) =>
      value
        .split(/(?<=[.!?。！？])\s+/)
        .map((part) => part.trim())
        .filter(Boolean).length

    const endsWithSentencePunctuation = (value: string) => /[.!?。！？]$/.test(value.trim())
    const looksAbruptlyCut = (source: string, translated: string) => {
      const cleaned = translated.trim()
      if (!cleaned) return true
      if (cleaned.endsWith('...') || cleaned.endsWith('…')) return true

      const sourceWords = Math.max(1, wordCount(source))
      const translatedWords = wordCount(cleaned)
      if (translatedWords < Math.ceil(sourceWords * 0.65)) return true

      const sourceSentences = sentenceCount(source)
      if (sourceSentences >= 2) {
        const translatedSentences = sentenceCount(cleaned)
        if (translatedSentences < Math.ceil(sourceSentences * 0.6)) return true
      }

      if (source.length > 280 && !endsWithSentencePunctuation(cleaned) && endsWithSentencePunctuation(source)) {
        return true
      }

      return false
    }

    const splitSentences = (value: string): string[] =>
      value
        .split(/(?<=[.!?。！？])(\s+)/)
        .reduce<string[]>((acc, part) => {
          if (!part) return acc
          if (/^\s+$/.test(part) && acc.length > 0) {
            acc[acc.length - 1] += part
            return acc
          }
          acc.push(part)
          return acc
        }, [])
        .filter((part) => part.trim().length > 0)

    const translateChunk = async (chunk: string, maxOutputTokens: number): Promise<string> => {
      const prompt = `Translate all content inside <SOURCE_TEXT> to ${langName}.
Do NOT summarize, shorten, omit, or reorder information.
Preserve formatting, punctuation, line breaks, URLs, hashtags, cashtags, and mentions exactly as in the source.

<SOURCE_TEXT>
${chunk}
</SOURCE_TEXT>`

      const result = await generateGeminiText({
        modelId: AI_CONFIG.translationModel,
        fallbackModelId: GEMINI_MODELS.fallback,
        prompt,
        generationConfig: {
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens,
          responseMimeType: 'text/plain',
        },
        systemInstruction:
          'You are a professional translator engine. Return only the full translation of the provided source text.',
      })

      return sanitize(result)
    }

    const translateSentence = async (sentence: string): Promise<string> => {
      const prompt = `Translate this text to ${langName} exactly as written.
Do NOT summarize, shorten, omit, or reorder.

<SOURCE_TEXT>
${sentence}
</SOURCE_TEXT>`

      const result = await generateGeminiText({
        modelId: AI_CONFIG.translationModel,
        fallbackModelId: GEMINI_MODELS.fallback,
        prompt,
        generationConfig: {
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain',
        },
        systemInstruction:
          'You are a professional translator engine. Return only the full translation of the provided source text.',
      })

      return sanitize(result)
    }

    const splitIntoChunks = (source: string, maxChars = 1200): string[] => {
      const paragraphs = source.split('\n')
      const chunks: string[] = []
      let current = ''

      const pushCurrent = () => {
        if (current.trim()) chunks.push(current.trim())
        current = ''
      }

      for (const paragraph of paragraphs) {
        const line = paragraph.trim()
        if (!line) {
          if (current.length + 1 > maxChars) pushCurrent()
          current += '\n'
          continue
        }

        if (line.length > maxChars) {
          pushCurrent()
          const sentences = line.split(/(?<=[.!?。！？])\s+/).filter(Boolean)
          let sentenceBucket = ''
          for (const sentence of sentences) {
            if ((sentenceBucket + ' ' + sentence).trim().length > maxChars) {
              if (sentenceBucket.trim()) chunks.push(sentenceBucket.trim())
              sentenceBucket = sentence
            } else {
              sentenceBucket = sentenceBucket ? `${sentenceBucket} ${sentence}` : sentence
            }
          }
          if (sentenceBucket.trim()) chunks.push(sentenceBucket.trim())
          continue
        }

        const candidate = current ? `${current}\n${line}` : line
        if (candidate.length > maxChars) {
          pushCurrent()
          current = line
        } else {
          current = candidate
        }
      }

      pushCurrent()
      return chunks.length > 0 ? chunks : [source]
    }

    const estimatedTokens = Math.ceil(text.length / 4)
    const maxOutputTokens = Math.min(8192, Math.max(1024, Math.ceil(estimatedTokens * 2.2)))

    const firstPass = await translateChunk(text, maxOutputTokens)
    if (!looksAbruptlyCut(text, firstPass)) {
      return firstPass
    }

    console.warn('[AI Translate] First pass looked truncated, retrying with chunk strategy', {
      sourceLength: text.length,
      firstPassLength: firstPass.length,
      language: lang,
    })

    const chunks = splitIntoChunks(text)
    if (chunks.length <= 1) {
      return firstPass
    }

    const translatedChunks: string[] = []
    for (const chunk of chunks) {
      const chunkTokens = Math.ceil(chunk.length / 4)
      const chunkMaxOutputTokens = Math.min(4096, Math.max(768, Math.ceil(chunkTokens * 2.2)))
      let translatedChunk = await translateChunk(chunk, chunkMaxOutputTokens)

      if (looksAbruptlyCut(chunk, translatedChunk)) {
        const sentences = splitSentences(chunk)
        const translatedSentences: string[] = []

        for (const sentence of sentences) {
          const translatedSentence = await translateSentence(sentence)
          translatedSentences.push(
            looksAbruptlyCut(sentence, translatedSentence) ? sentence : translatedSentence
          )
        }

        translatedChunk = translatedSentences.join('')
      }

      translatedChunks.push(looksAbruptlyCut(chunk, translatedChunk) ? chunk : translatedChunk)
    }

    return translatedChunks.join('\n')
  }

  // === Private helpers ===

  private buildSystemContext(profile: StyleProfile, maxChars: number, accountContext?: AccountContext): string {
    let context = `You are a writing assistant for a Farcaster user.

USER PROFILE:
- Natural tone: ${profile.tone}
- Average length: ${profile.avgLength} characters
- Typical phrases: ${profile.commonPhrases.join(', ')}
- Frequent topics: ${profile.topics.join(', ')}
- Emoji usage: ${profile.emojiUsage}
- Preferred language: ${profile.languagePreference}`

    // Add engagement insights if available
    if (profile.engagementInsights && profile.engagementInsights.length > 0) {
      const sortedInsights = profile.engagementInsights
        .map(insight => {
          const avgScore = insight.scores.reduce((a, b) => a + b, 0) / insight.scores.length
          return { topic: insight.topic, avgScore: Math.round(avgScore) }
        })
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 3) // Top 3 topics

      if (sortedInsights.length > 0) {
        context += `\n\nUSER'S SUCCESSFUL CONTENT (Topics that get high engagement):
${sortedInsights.map(i => `- ${i.topic} (Engagement Score: ${i.avgScore})`).join('\n')}`
      }
    }

    // Add account context if exists
    if (accountContext) {
      if (accountContext.brandVoice) {
        context += `\n\nBRAND VOICE:\n${accountContext.brandVoice}`
      }
      if (accountContext.bio) {
        context += `\n\nBIO:\n${accountContext.bio}`
      }
      if (accountContext.expertise?.length) {
        context += `\n\nEXPERTISE AREAS:\n- ${accountContext.expertise.join('\n- ')}`
      }
      if (accountContext.alwaysDo?.length) {
        context += `\n\nALWAYS DO:\n- ${accountContext.alwaysDo.join('\n- ')}`
      }
      if (accountContext.neverDo?.length) {
        context += `\n\nNEVER DO:\n- ${accountContext.neverDo.join('\n- ')}`
      }
      if (accountContext.hashtags?.length) {
        context += `\n\nPREFERRED HASHTAGS: ${accountContext.hashtags.join(', ')}`
      }
    }

    context += `\n\nEXAMPLES OF HOW THE USER WRITES:
${profile.sampleCasts.slice(0, 5).map((cast, i) => `${i + 1}. "${cast}"`).join('\n')}

RULES:
- Maximum ${maxChars} characters per suggestion
- Maintain the user's natural tone and style
- Use their vocabulary and typical expressions`

    if (accountContext?.neverDo?.length) {
      context += `\n- IMPORTANT: Never do the following: ${accountContext.neverDo.join(', ')}`
    }

    return context
  }

  private buildWritePrompt(
    context: SuggestionContext,
    maxChars: number,
    profileLanguagePreference: StyleProfile['languagePreference']
  ): string {
    const targetLang = resolveWritingLanguage(context.targetLanguage, profileLanguagePreference)
    let prompt = `Write in ${toEnglishLanguageName(targetLang)}.\n\n`

    if (context.replyingTo) {
      prompt += `Replying to @${context.replyingTo.author}:\n"${context.replyingTo.text}"\n\n`
    }

    if (context.quotingCast) {
      prompt += `Quoting @${context.quotingCast.author}:\n"${context.quotingCast.text}"\n\n`
    }

    if (context.topic) {
      prompt += `Topic: ${context.topic}\n\n`
    }

    if (context.targetTone) {
      prompt += `Desired tone: ${context.targetTone}\n\n`
    }

    prompt += `Generate exactly 3 different options (max ${maxChars} characters each).

Return ONLY valid JSON (no markdown, no extra text):
{
  "suggestions": ["option 1", "option 2", "option 3"]
}`

    return prompt
  }

  private buildImprovePrompt(
    context: SuggestionContext,
    maxChars: number,
    profileLanguagePreference: StyleProfile['languagePreference']
  ): string {
    if (!context.currentDraft) {
      throw new Error('Draft is required for improve mode')
    }

    const targetLang = resolveWritingLanguage(context.targetLanguage, profileLanguagePreference)
    let prompt = `Write improvements in ${toEnglishLanguageName(targetLang)}.\n\n`
    prompt += `User draft:\n"${context.currentDraft}"\n\n`

    if (context.targetTone) {
      prompt += `Adjust to tone: ${context.targetTone}\n\n`
    }

    const preferredMinChars = Math.max(
      Math.min(Math.floor(maxChars * 0.6), maxChars - 40),
      Math.min(220, maxChars)
    )

    prompt += `Improve this draft keeping the essence but making it more effective.
You can expand the text with stronger framing, clearer arguments, and better flow when helpful.
Prioritize substantial outputs: target roughly ${preferredMinChars}-${maxChars} characters when possible (never exceed ${maxChars}).
Provide exactly 3 improved versions (max ${maxChars} characters each).

Return ONLY valid JSON (no markdown, no extra text):
{
  "suggestions": ["version 1", "version 2", "version 3"]
}`

    return prompt
  }

  private buildTranslatePrompt(context: SuggestionContext): string {
    if (!context.currentDraft) {
      throw new Error('Text is required for translate mode')
    }

    const targetLang = assertSupportedTargetLanguage(context.targetLanguage)

    const langName = toEnglishLanguageName(targetLang)

    return `Translate this COMPLETE text to ${langName}:

"${context.currentDraft}"

Provide 3 translation versions:
1. Literal — preserve exact meaning, sentence structure, and length
2. Natural — slightly adapted for fluency in ${langName}
3. Concise — same meaning, tighter phrasing

IMPORTANT: Do NOT summarize, shorten, or omit any part of the text. Each version must translate the COMPLETE text faithfully.

Return ONLY valid JSON (no markdown, no extra text):
{
  "suggestions": ["translation 1", "translation 2", "translation 3"]
}`
  }

  private parseSuggestions(text: string, maxChars: number): string[] {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = this.safeParseJson(cleaned)
    const suggestionsRaw = parsed?.suggestions

    if (!Array.isArray(suggestionsRaw)) {
      throw new Error('Invalid AI response: expected suggestions array')
    }

    const suggestions = suggestionsRaw
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s.length > 0)
      .filter((s) => s.length <= maxChars)
      .slice(0, 3)

    if (suggestions.length === 0) {
      throw new Error('Invalid AI response: no valid suggestions')
    }

    return suggestions
  }

  private safeParseJson(input: string): { suggestions?: unknown } | null {
    try {
      return JSON.parse(input) as { suggestions?: unknown }
    } catch {
      // Attempt to extract the first JSON object from the response
      const match = input.match(/\{[\s\S]*\}/)
      if (!match) return null
      try {
        return JSON.parse(match[0]) as { suggestions?: unknown }
      } catch {
        return null
      }
    }
  }

  private createDefaultProfile(userId: string, fid: number): StyleProfile {
    return {
      id: nanoid(),
      userId,
      fid,
      tone: 'casual',
      avgLength: 150,
      commonPhrases: [],
      topics: [],
      emojiUsage: 'light',
      languagePreference: 'en',
      sampleCasts: [],
      analyzedAt: new Date(),
    }
  }

  private dbProfileToStyleProfile(dbProfile: typeof userStyleProfiles.$inferSelect): StyleProfile {
    return {
      id: dbProfile.id,
      userId: dbProfile.userId,
      fid: dbProfile.fid,
      tone: dbProfile.tone as StyleProfile['tone'],
      avgLength: dbProfile.avgLength,
      commonPhrases: JSON.parse(dbProfile.commonPhrases || '[]'),
      topics: JSON.parse(dbProfile.topics || '[]'),
      emojiUsage: dbProfile.emojiUsage as StyleProfile['emojiUsage'],
      languagePreference: dbProfile.languagePreference as StyleProfile['languagePreference'],
      sampleCasts: JSON.parse(dbProfile.sampleCasts || '[]'),
      analyzedAt: dbProfile.analyzedAt,
      engagementInsights: dbProfile.engagementInsights ? JSON.parse(dbProfile.engagementInsights) : [],
    }
  }
}

// Singleton instance
export const castorAI = new CastorAI()
