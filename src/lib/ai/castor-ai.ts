import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai'
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
  targetPlatform?: 'farcaster' | 'x' | 'linkedin'
  accountContext?: AccountContext
}

export type AIMode = 'write' | 'improve' | 'humanize' | 'translate'

export class CastorAI {
  constructor() {
  }

  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
  private proModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
  private accountContextCache = new Map<string, { value: AccountContext | null; expiresAt: number }>()
  private profileRefreshInFlight = new Map<string, Promise<void>>()

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
  private async generate(prompt: string, options?: { isTranslation?: boolean; usePro?: boolean; expectJson?: boolean; responseSchema?: Schema }): Promise<string> {
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
            responseMimeType: options?.expectJson ? 'application/json' : 'text/plain',
            responseSchema: options?.responseSchema,
          },
          systemInstruction: options?.expectJson 
            ? 'You are a professional translator engine. Return valid JSON containing the translation suggestions exactly matching the requested format.' 
            : 'You are a professional translator engine. You receive text and return ONLY the translation. Do not include explanations, intro text, or markdown formatting unless requested. Preserve original formatting.',
        })
      } else {
        const model = options?.usePro ? this.getProModel() : this.getModel()
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: options?.expectJson ? { 
            responseMimeType: 'application/json',
            responseSchema: options?.responseSchema,
          } : undefined,
        })
        const response = await result.response
        return response.text().trim()
      }
    } catch (error) {
      console.error('Gemini generation error:', error)
      throw error
    }
  }

  /**
   * Obtiene o crea el perfil de estilo del usuario de forma instantánea.
   * Si no existe, devuelve uno genérico e inicia el análisis en segundo plano.
   */
  async getOrCreateProfile(userId: string, fid: number): Promise<StyleProfile> {
    // Buscar perfil existente
    const existing = await db.query.userStyleProfiles.findFirst({
      where: eq(userStyleProfiles.userId, userId),
    })

    if (existing) {
      // Verificar si necesita actualización (más de 7 días)
      const daysSinceAnalysis = (Date.now() - existing.analyzedAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysSinceAnalysis >= AI_CONFIG.cacheProfileDays) {
        this.refreshProfileInBackground(userId, fid)
      }

      // Nunca bloqueamos al usuario por re-análisis pesado de perfil.
      return this.dbProfileToStyleProfile(existing)
    }

    // Usuario nuevo: Devolver perfil genérico inmediatamente
    // e iniciar análisis de estilo en segundo plano (Neynar + Gemini Pro)
    this.refreshProfileInBackground(userId, fid)

    return this.createDefaultProfile(userId, fid)
  }

  private refreshProfileInBackground(userId: string, fid: number): void {
    const key = `${userId}:${fid}`
    if (this.profileRefreshInFlight.has(key)) return

    try {
      const refreshPromise = this.analyzeAndSaveProfile(userId, fid)
        .then(() => undefined)
        .catch((error) => {
          console.warn('[CastorAI] Background profile refresh failed:', error)
        })
        .finally(() => {
          this.profileRefreshInFlight.delete(key)
        })

      this.profileRefreshInFlight.set(key, refreshPromise)
    } catch (e) {
      console.warn('[CastorAI] Failed to initiate background refresh:', e)
      this.profileRefreshInFlight.delete(key)
    }
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
`

      const profileSchema: Schema = {
        type: SchemaType.OBJECT,
        properties: {
          tone: { type: SchemaType.STRING, description: "Must be: casual, formal, technical, humorous, or mixed" },
          avgLength: { type: SchemaType.INTEGER, description: "Average length of casts in characters" },
          commonPhrases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          topics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          emojiUsage: { type: SchemaType.STRING, description: "Must be: none, light, or heavy" },
          languagePreference: { type: SchemaType.STRING, description: "Must be: en, es, or mixed" },
          powerPhrases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          contentPatterns: { type: SchemaType.STRING, description: "Description of dominant content patterns" },
        },
        required: ["tone", "avgLength", "commonPhrases", "topics", "emojiUsage", "languagePreference"]
      }

      const resultText = await this.generate(analysisPrompt, { 
        usePro: true, 
        expectJson: true,
        responseSchema: profileSchema
      })
      let analysis: any = {}
      try {
        analysis = JSON.parse(resultText)
      } catch (e) {
        console.warn('Failed to parse analysis JSON fallback to defaults')
      }

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
    const suggestionCount = mode === 'write' ? 3 : 2
    const systemContext = this.buildSystemContext(profile, maxChars, context.accountContext)
    let userPrompt: string

    switch (mode) {
      case 'write':
        userPrompt = this.buildWritePrompt(context, maxChars, profile.languagePreference, suggestionCount)
        break
      case 'improve':
        userPrompt = this.buildImprovePrompt(
          context,
          maxChars,
          profile.languagePreference,
          this.computeImproveMinChars(context.currentDraft || '', maxChars),
          suggestionCount
        )
        break
      case 'humanize':
        userPrompt = this.buildHumanizePrompt(
          context,
          maxChars,
          profile.languagePreference,
          suggestionCount
        )
        break
      case 'translate':
        userPrompt = this.buildTranslatePrompt(context, suggestionCount)
        break
      default:
        throw new Error(`Invalid mode: ${mode}`)
    }

    const fullPrompt = `${systemContext}\n\n---\n\n${userPrompt}`
    
    const suggestionSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        suggestions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ["suggestions"]
    }

    const resultText = await this.generate(fullPrompt, {
      isTranslation: mode === 'translate',
      usePro: isProUser,
      expectJson: true,
      responseSchema: suggestionSchema
    })

    const parseLimit = mode === 'translate' ? Math.max(maxChars, 10000) : maxChars
    let parsed: { suggestions?: string[] }
    try {
      parsed = JSON.parse(resultText)
    } catch (e) {
      throw new Error('Invalid AI response: not a valid JSON string')
    }

    if (!parsed || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      throw new Error('Invalid AI response: expected a non-empty suggestions array')
    }

    let suggestions = parsed.suggestions
      .filter((s): s is string => typeof s === 'string')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(s => s.length > 0 && s.length <= parseLimit)
      .slice(0, suggestionCount)

    if (suggestions.length === 0) {
      throw new Error('Invalid AI response: no valid suggestions matched criteria')
    }

    if (mode === 'improve' && context.currentDraft && isProUser) {
      const minChars = this.computeImproveMinChars(context.currentDraft, maxChars)
      if (this.shouldRetryImproveForLength(suggestions, context.currentDraft.length, minChars)) {
        const retryPrompt = `${fullPrompt}

LENGTH RETRY (MANDATORY):
- Original draft length: ${context.currentDraft.length} chars
- Each improved version MUST be more developed and materially longer than the draft
- Target at least ${minChars} characters per version when possible
- Keep under ${maxChars} characters`

        const retryText = await this.generate(retryPrompt, {
          isTranslation: false,
          usePro: true,
          expectJson: true,
          responseSchema: suggestionSchema
        })
        
        try {
          const retryParsed = JSON.parse(retryText)
          if (retryParsed && Array.isArray(retryParsed.suggestions)) {
            suggestions = retryParsed.suggestions
              .filter((s: unknown): s is string => typeof s === 'string')
              .map((s: string) => s.trim().replace(/^["']|["']$/g, ''))
              .filter((s: string) => s.length > 0 && s.length <= parseLimit)
              .slice(0, suggestionCount)
          }
        } catch (e) {
          // ignore retry parse error and fallback to initial suggestions
        }
      }
    }

    return suggestions
  }

  /**
   * Translate text to another language
   */
  async translate(text: string, targetLanguage: string): Promise<string> {
    const lang = assertSupportedTargetLanguage(targetLanguage)
    const langName = toEnglishLanguageName(lang)
    const sanitize = (value: string) => value.trim().replace(/^["']|["']$/g, '')

    const translateChunk = async (chunk: string): Promise<string> => {
      const prompt = `Translate all content inside <SOURCE_TEXT> to ${langName}.
Do NOT summarize, shorten, omit, or reorder information.
Preserve formatting, punctuation, line breaks, URLs, hashtags, cashtags, and mentions exactly as in the source.

<SOURCE_TEXT>
${chunk}
</SOURCE_TEXT>`

      const translationSchema: Schema = {
        type: SchemaType.OBJECT,
        properties: {
          translation: { type: SchemaType.STRING }
        },
        required: ["translation"]
      }

      try {
        const result = await generateGeminiText({
          modelId: AI_CONFIG.translationModel,
          fallbackModelId: GEMINI_MODELS.fallback,
          prompt,
          generationConfig: {
            temperature: 0.1,
            topP: 0.9,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: translationSchema,
          },
          systemInstruction:
            'You are a professional translator engine. Return valid JSON containing the translation exactly matching the requested format.',
        })

        const parsed = JSON.parse(result)
        return sanitize(parsed.translation || '')
      } catch (error) {
        console.error('[AI Translate] Error translating chunk:', error)
        // Re-throw Rate Limit errors so they can be handled upstream appropriately
        if (error instanceof Error && (error.message.includes('429') || error.message.includes('quota'))) {
          throw error
        }
        throw new Error('Failed to translate text')
      }
    }

    const splitIntoParagraphs = (source: string, maxChars = 5000): string[] => {
      const paragraphs = source.split('\n\n')
      const chunks: string[] = []
      let current = ''

      for (const paragraph of paragraphs) {
        const candidate = current ? `${current}\n\n${paragraph}` : paragraph
        if (candidate.length > maxChars && current) {
          chunks.push(current)
          current = paragraph
        } else {
          current = candidate
        }
      }

      if (current) {
        chunks.push(current)
      }

      return chunks.length > 0 ? chunks : [source]
    }

    // Para la inmensa mayoría de posts de redes sociales (< 5000 chars), se envía en una sola llamada
    if (text.length <= 5000) {
      return await translateChunk(text)
    }

    // Si es un texto masivo, lo dividimos solo por bloques grandes de párrafos
    console.warn(`[AI Translate] Text length ${text.length} exceeds fast-path threshold, chunking by paragraphs`)
    const chunks = splitIntoParagraphs(text)
    
    if (chunks.length <= 1) {
      return await translateChunk(text)
    }

    const translatedChunks: string[] = []
    for (const chunk of chunks) {
      if (!chunk.trim()) {
        translatedChunks.push('')
        continue
      }
      const translatedChunk = await translateChunk(chunk)
      translatedChunks.push(translatedChunk)
    }

    return translatedChunks.join('\n\n')
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
${profile.sampleCasts.slice(0, 2).map((cast, i) => `${i + 1}. "${cast}"`).join('\n')}

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
    profileLanguagePreference: StyleProfile['languagePreference'],
    suggestionCount: number
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

    prompt += `Generate exactly ${suggestionCount} different options (max ${maxChars} characters each).`

    return prompt
  }

  private buildImprovePrompt(
    context: SuggestionContext,
    maxChars: number,
    profileLanguagePreference: StyleProfile['languagePreference'],
    minCharsTarget: number,
    suggestionCount: number
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
    if (context.targetPlatform) {
      prompt += `Target platform: ${context.targetPlatform}\n`
      if (context.targetPlatform === 'x') {
        prompt += 'Prioritize concise, punchy phrasing suitable for X.\n\n'
      } else if (context.targetPlatform === 'linkedin') {
        prompt += 'Prioritize professional clarity and structured ideas suitable for LinkedIn.\n\n'
      } else {
        prompt += 'Prioritize native Farcaster tone and cadence.\n\n'
      }
    }

    prompt += `Improve this draft keeping the essence but making it more effective.
You can expand the text with stronger framing, clearer arguments, and better flow when helpful.
Prioritize substantial outputs: target roughly ${minCharsTarget}-${maxChars} characters when possible (never exceed ${maxChars}).
Each version should feel clearly more developed and materially longer than the original draft.
Provide exactly ${suggestionCount} improved versions (max ${maxChars} characters each).`

    return prompt
  }

  private computeImproveMinChars(draft: string, maxChars: number): number {
    const draftLength = draft.trim().length
    const safeMaxTarget = Math.max(40, maxChars - 20)

    const growth =
      draftLength < 120 ? 40 :
      draftLength < 260 ? 70 :
      50

    const floor =
      draftLength < 120 ? 90 :
      draftLength < 260 ? 180 :
      Math.floor(draftLength * 1.15)

    const desired = Math.max(draftLength + growth, floor)
    return Math.min(safeMaxTarget, desired)
  }

  private shouldRetryImproveForLength(
    suggestions: string[],
    draftLength: number,
    minCharsTarget: number
  ): boolean {
    if (suggestions.length === 0) return false

    const meetsMinTarget = suggestions.filter((s) => s.length >= minCharsTarget).length
    const clearlyLonger = suggestions.filter((s) => s.length >= draftLength + 20).length

    return meetsMinTarget === 0 && clearlyLonger < 2
  }

  private buildTranslatePrompt(context: SuggestionContext, suggestionCount: number): string {
    if (!context.currentDraft) {
      throw new Error('Text is required for translate mode')
    }

    const targetLang = assertSupportedTargetLanguage(context.targetLanguage)

    const langName = toEnglishLanguageName(targetLang)

    return `Translate this COMPLETE text to ${langName}:

"${context.currentDraft}"

Provide ${suggestionCount} translation versions:
1. Literal — preserve exact meaning, sentence structure, and length
2. Natural — slightly adapted for fluency in ${langName}

IMPORTANT: Do NOT summarize, shorten, or omit any part of the text. Each version must translate the COMPLETE text faithfully.`
  }

  private buildHumanizePrompt(
    context: SuggestionContext,
    maxChars: number,
    profileLanguagePreference: StyleProfile['languagePreference'],
    suggestionCount: number
  ): string {
    if (!context.currentDraft) {
      throw new Error('Draft is required for humanize mode')
    }

    const targetLang = resolveWritingLanguage(context.targetLanguage, profileLanguagePreference)
    let prompt = `Humanize this text in ${toEnglishLanguageName(targetLang)}.\n\n`
    prompt += `User draft:\n"${context.currentDraft}"\n\n`

    if (context.targetTone) {
      prompt += `Tone preference: ${context.targetTone}\n\n`
    }

    if (context.targetPlatform) {
      prompt += `Target platform: ${context.targetPlatform}\n`
      if (context.targetPlatform === 'x') {
        prompt += 'Keep it tight, direct, and timeline-native for X.\n\n'
      } else if (context.targetPlatform === 'linkedin') {
        prompt += 'Keep it clear, natural, and professional for LinkedIn.\n\n'
      } else {
        prompt += 'Keep it conversational and native to Farcaster.\n\n'
      }
    }

    prompt += `Rewrite to sound more human and less generic/AI-like:
- Keep the original meaning and intent
- Do NOT invent facts, claims, numbers, or names
- Reduce boilerplate and robotic phrasing
- Vary sentence rhythm and improve flow
- Keep similar length where possible

Provide exactly ${suggestionCount} humanized versions (max ${maxChars} characters each).`

    return prompt
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
