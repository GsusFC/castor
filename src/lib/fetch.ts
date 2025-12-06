/**
 * Fetch con timeout configurable
 * Previene requests colgados indefinidamente
 */

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`)
    this.name = 'FetchTimeoutError'
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number
}

// Timeouts por defecto según tipo de operación
export const DEFAULT_TIMEOUTS = {
  API: 30_000,      // 30s para APIs externas (Neynar, etc)
  UPLOAD: 120_000,  // 2min para uploads de media
  WEBHOOK: 10_000,  // 10s para webhooks
  HEALTH: 5_000,    // 5s para health checks
} as const

/**
 * Fetch con timeout automático
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUTS.API, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchTimeoutError(url, timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
