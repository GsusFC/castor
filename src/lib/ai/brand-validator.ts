import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireGeminiEnv } from '@/lib/env'
import { AccountContext, StyleProfile } from './castor-ai'

/**
 * Validación de coherencia de marca para sugerencias IA
 *
 * Verifica que una sugerencia respeta:
 * - Tono de marca
 * - Longitud esperada
 * - Reglas "siempre hacer" y "nunca hacer"
 * - Temas de expertise
 * - Patrones de lenguaje establecidos
 */

export interface BrandValidationResult {
  isCoherent: boolean
  coherenceScore: number // 0-100
  violations: string[]
  strengths: string[]
  feedback: string
  category: 'perfect' | 'good' | 'acceptable' | 'off_brand'
}

export class BrandValidator {
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null

  private getModel() {
    if (this.model) return this.model
    const { GEMINI_API_KEY } = requireGeminiEnv()
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    return this.model
  }

  /**
   * Genera contenido usando el modelo
   */
  private async generate(prompt: string): Promise<string> {
    try {
      const model = this.getModel()
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text().trim()
    } catch (error) {
      console.error('Gemini validation error:', error)
      throw error
    }
  }

  /**
   * Valida una sugerencia contra el perfil de usuario y contexto de marca
   */
  async validate(
    suggestion: string,
    userProfile: StyleProfile,
    accountContext?: AccountContext
  ): Promise<BrandValidationResult> {
    try {
      // Si no hay contexto de marca, hacer validación básica
      if (!accountContext?.brandVoice) {
        return this.validateBasic(suggestion, userProfile)
      }

      // Validación completa con brand voice
      return await this.validateWithBrand(suggestion, userProfile, accountContext)
    } catch (error) {
      console.error('[BrandValidator] Validation error:', error)
      // Si falla la validación por IA, retornar validación genérica
      return this.validateBasic(suggestion, userProfile)
    }
  }

  /**
   * Validación básica solo con profile del usuario (sin brand voice)
   */
  private validateBasic(suggestion: string, profile: StyleProfile): BrandValidationResult {
    const violations: string[] = []
    const strengths: string[] = []
    let score = 100

    // Validar longitud
    const lengthDiff = Math.abs(suggestion.length - profile.avgLength)
    const lengthDiffPercent = (lengthDiff / profile.avgLength) * 100

    if (lengthDiffPercent > 50) {
      violations.push(`Longitud muy diferente de tu promedio (${profile.avgLength} chars)`)
      score -= 20
    } else if (lengthDiffPercent > 25) {
      violations.push(`Longitud algo diferente de tu promedio`)
      score -= 10
    } else {
      strengths.push('Longitud coherente con tu estilo')
    }

    // Validar emojis
    const emojiCount = (suggestion.match(/[\p{Emoji}]/gu) || []).length
    const hasEmojis = emojiCount > 0

    if (profile.emojiUsage === 'none' && hasEmojis) {
      violations.push('Tienes emojis pero no los usas normalmente')
      score -= 15
    } else if (profile.emojiUsage === 'heavy' && !hasEmojis) {
      violations.push('No tiene emojis y típicamente los usas bastante')
      score -= 10
    } else if (profile.emojiUsage === 'light' && emojiCount > 2) {
      violations.push('Demasiados emojis para tu estilo')
      score -= 5
    } else {
      strengths.push('Uso de emojis coherente')
    }

    // Validar comillas/formato
    if (profile.commonPhrases.length > 0) {
      const hasPhrases = profile.commonPhrases.some((phrase) =>
        suggestion.toLowerCase().includes(phrase.toLowerCase())
      )
      if (hasPhrases) {
        strengths.push('Incluye frases que usas normalmente')
      }
    }

    score = Math.max(0, Math.min(100, score))

    return {
      isCoherent: score >= 70,
      coherenceScore: score,
      violations,
      strengths,
      feedback: this.generateFeedback(score, violations, strengths),
      category: this.scoreToCategory(score),
    }
  }

  /**
   * Validación completa con Brand Voice
   */
  private async validateWithBrand(
    suggestion: string,
    profile: StyleProfile,
    accountContext: AccountContext
  ): Promise<BrandValidationResult> {
    // Construir prompt para IA
    const validationPrompt = this.buildValidationPrompt(suggestion, profile, accountContext)

    const resultText = await this.generate(validationPrompt)
    const cleanedResult = resultText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const validation = JSON.parse(cleanedResult) as {
      isCoherent: boolean
      coherenceScore: number
      violations?: string[]
      strengths?: string[]
      feedback?: string
    }

    return {
      isCoherent: validation.isCoherent,
      coherenceScore: Math.max(0, Math.min(100, validation.coherenceScore || 0)),
      violations: validation.violations || [],
      strengths: validation.strengths || [],
      feedback: validation.feedback || 'No comment',
      category: this.scoreToCategory(validation.coherenceScore || 0),
    }
  }

  /**
   * Construye el prompt para validación con IA
   */
  private buildValidationPrompt(
    suggestion: string,
    profile: StyleProfile,
    accountContext: AccountContext
  ): string {
    return `You are a brand voice validator. Analyze if this suggestion follows the user's established brand voice and style.

USER PROFILE:
- Tone: ${profile.tone}
- Average length: ${profile.avgLength} characters
- Common phrases: ${profile.commonPhrases.join(', ') || '(none)'}
- Frequent topics: ${profile.topics.join(', ') || '(none)'}
- Emoji usage: ${profile.emojiUsage}
- Language preference: ${profile.languagePreference}

BRAND VOICE:
${accountContext.brandVoice || '(not defined)'}

${accountContext.expertise?.length ? `EXPERTISE AREAS:\n- ${accountContext.expertise.join('\n- ')}` : ''}

${accountContext.alwaysDo?.length ? `ALWAYS DO:\n- ${accountContext.alwaysDo.join('\n- ')}` : ''}

${accountContext.neverDo?.length ? `NEVER DO:\n- ${accountContext.neverDo.join('\n- ')}` : ''}

SUGGESTION TO VALIDATE:
"${suggestion}"

Analyze and respond ONLY with valid JSON (no markdown):
{
  "isCoherent": boolean,
  "coherenceScore": <0-100>,
  "violations": [<list of issues if any>],
  "strengths": [<list of positive aspects>],
  "feedback": "<brief explanation>"
}`
  }

  /**
   * Mapea score numérico a categoría
   */
  private scoreToCategory(score: number): BrandValidationResult['category'] {
    if (score >= 90) return 'perfect'
    if (score >= 75) return 'good'
    if (score >= 60) return 'acceptable'
    return 'off_brand'
  }

  /**
   * Genera feedback amigable basado en score y validaciones
   */
  private generateFeedback(
    score: number,
    violations: string[],
    strengths: string[]
  ): string {
    if (score >= 90) {
      return strengths[0] || 'Perfect match for your brand voice! ✨'
    } else if (score >= 75) {
      return 'This fits your brand well with minor adjustments'
    } else if (score >= 60) {
      return `Mostly aligned: ${violations[0] || 'consider adjusting'}`
    } else {
      return `Off-brand: ${violations[0] || "doesn't match your style"}`
    }
  }
}

// Singleton instance
export const brandValidator = new BrandValidator()
