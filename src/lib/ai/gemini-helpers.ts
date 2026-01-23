import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { requireGeminiEnv } from '@/lib/env'
import { GEMINI_TIMEOUT_MS } from '@/lib/ai/gemini-config'

type GenerateParams = {
  modelId: string
  prompt: string
  generationConfig?: GenerationConfig
  systemInstruction?: string
  timeoutMs?: number
}

type GenerateWithFallbackParams = GenerateParams & {
  fallbackModelId?: string
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini timeout after ${timeoutMs}ms (${label})`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

const generateTextOnce = async ({
  modelId,
  prompt,
  generationConfig,
  systemInstruction,
  timeoutMs = GEMINI_TIMEOUT_MS,
}: GenerateParams): Promise<string> => {
  const { GEMINI_API_KEY } = requireGeminiEnv()
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

  const model = genAI.getGenerativeModel({
    model: modelId,
    ...(generationConfig ? { generationConfig } : {}),
    ...(systemInstruction ? { systemInstruction } : {}),
  })

  const result = await withTimeout(model.generateContent(prompt), timeoutMs, modelId)
  const response = await result.response
  return response.text().trim()
}

export const generateGeminiText = async ({
  fallbackModelId,
  ...params
}: GenerateWithFallbackParams): Promise<string> => {
  try {
    return await generateTextOnce(params)
  } catch (error) {
    if (!fallbackModelId || fallbackModelId === params.modelId) {
      throw error
    }

    console.warn('[Gemini] Primary model failed, falling back', {
      primary: params.modelId,
      fallback: fallbackModelId,
      error: error instanceof Error ? error.message : String(error),
    })

    return await generateTextOnce({ ...params, modelId: fallbackModelId })
  }
}
