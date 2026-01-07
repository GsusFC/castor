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

export { assertSupportedTargetLanguage, toEnglishLanguageName, toSpanishLanguageName }
export type { SupportedTargetLanguage }

// Initialize Google AI with the stable SDK
// Configuración según entorno
const AI_CONFIG = {
  model: 'gemini-2.0-flash', // Modelo de alto rendimiento (2k RPM en plan pago)
  analysisPromptSize: env.NODE_ENV === 'production' ? 25 : 15, // Aumentamos contexto
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

  private getModel() {
    if (this.model) return this.model
    const { GEMINI_API_KEY } = requireGeminiEnv()
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    this.model = genAI.getGenerativeModel({ model: AI_CONFIG.model })
    return this.model
  }

  /**
   * Genera contenido usando el modelo configurado
   */
  private async generate(prompt: string): Promise<string> {
    try {
      const model = this.getModel()
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text().trim()
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
Analyze the writing style of this Farcaster user based on their casts:

${castTexts.slice(0, AI_CONFIG.analysisPromptSize).map((text: string, i: number) => `${i + 1}. "${text}"`).join('\n')}

Respond ONLY with valid JSON (no markdown):
{
  "tone": "casual|formal|technical|humorous|mixed",
  "avgLength": <average number of characters>,
  "commonPhrases": ["phrase1", "phrase2", "phrase3"],
  "topics": ["topic1", "topic2", "topic3"],
  "emojiUsage": "none|light|heavy",
  "languagePreference": "en|es|mixed"
}`

      const resultText = await this.generate(analysisPrompt)
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
      const kb = await db.query.accountKnowledgeBase.findFirst({
        where: eq(accountKnowledgeBase.accountId, accountId),
      })

      if (!kb) return null

      return {
        brandVoice: kb.brandVoice || undefined,
        bio: kb.bio || undefined,
        expertise: kb.expertise ? JSON.parse(kb.expertise) : undefined,
        alwaysDo: kb.alwaysDo ? JSON.parse(kb.alwaysDo) : undefined,
        neverDo: kb.neverDo ? JSON.parse(kb.neverDo) : undefined,
        hashtags: kb.hashtags ? JSON.parse(kb.hashtags) : undefined,
        defaultTone: kb.defaultTone || undefined,
        defaultLanguage: kb.defaultLanguage || undefined,
      }
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
    maxChars: number = 320
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
    const resultText = await this.generate(fullPrompt)
    return this.parseSuggestions(resultText, maxChars)
  }

  /**
   * Translate text to another language
   */
  async translate(text: string, targetLanguage: string): Promise<string> {
    const lang = assertSupportedTargetLanguage(targetLanguage)
    const langName = toEnglishLanguageName(lang)
    const prompt = `Translate this text to ${langName}. Respond ONLY with the translation, no explanations:

"${text}"`

    const resultText = await this.generate(prompt)
    return resultText.trim().replace(/^["']|["']$/g, '')
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

    prompt += `Improve this draft keeping the essence but making it more effective.
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

    return `Translate this text to ${toEnglishLanguageName(targetLang)}, maintaining the tone and style:

"${context.currentDraft}"

Provide 3 versions of the translation with different nuances.

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

    const parsed = JSON.parse(cleaned) as unknown
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid AI response: expected JSON object')
    }

    const suggestionsRaw = (parsed as { suggestions?: unknown }).suggestions
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
    }
  }
}

// Singleton instance
export const castorAI = new CastorAI()
