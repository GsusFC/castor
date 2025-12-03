import { logger } from './logger'

// ============================================
// Retry Configuration
// ============================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number
  /** Initial delay in milliseconds */
  initialDelayMs?: number
  /** Maximum delay in milliseconds */
  maxDelayMs?: number
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number
  /** Whether to add jitter to delays */
  jitter?: boolean
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean
  /** Called before each retry */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
  onRetry: () => {},
}

// ============================================
// Retry Logic
// ============================================

/**
 * Calculates delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)
  
  // Cap at max delay
  delay = Math.min(delay, maxDelayMs)
  
  // Add jitter (±25%)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5 // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor)
  }
  
  return delay
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Executes a function with automatic retries on failure
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt === opts.maxAttempts || !opts.isRetryable(error)) {
        throw error
      }

      // Calculate delay
      const delayMs = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter
      )

      // Notify about retry
      opts.onRetry(attempt, error, delayMs)

      // Wait before retrying
      await sleep(delayMs)
    }
  }

  throw lastError
}

// ============================================
// Specialized Retry Functions
// ============================================

/**
 * Retry configuration for external API calls (Neynar, Cloudinary, etc.)
 */
export function retryExternalApi<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    isRetryable: (error) => {
      // Retry on network errors and 5xx responses
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        if (message.includes('network') || 
            message.includes('timeout') ||
            message.includes('econnreset') ||
            message.includes('socket')) {
          return true
        }
      }
      // Check for HTTP status codes
      if (typeof error === 'object' && error !== null && 'status' in error) {
        const status = (error as { status: number }).status
        return status >= 500 || status === 429
      }
      return false
    },
    onRetry: (attempt, error, delayMs) => {
      logger.warn({
        context,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error',
        delayMs,
      }, `Retrying ${context}`)
    },
  })
}

/**
 * Retry configuration for database operations
 */
export function retryDatabase<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    isRetryable: (error) => {
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        // Retry on connection/lock errors
        return message.includes('busy') ||
               message.includes('locked') ||
               message.includes('connection') ||
               message.includes('timeout')
      }
      return false
    },
    onRetry: (attempt, error, delayMs) => {
      logger.warn({
        context,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error',
        delayMs,
      }, `Retrying database operation: ${context}`)
    },
  })
}

// ============================================
// Circuit Breaker Pattern
// ============================================

interface CircuitBreakerState {
  failures: number
  lastFailure: number
  state: 'closed' | 'open' | 'half-open'
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs?: number
}

const DEFAULT_CIRCUIT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
}

/**
 * Executes a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_CIRCUIT_OPTIONS, ...options }
  
  // Get or create circuit state
  let circuit = circuitBreakers.get(key)
  if (!circuit) {
    circuit = { failures: 0, lastFailure: 0, state: 'closed' }
    circuitBreakers.set(key, circuit)
  }

  const now = Date.now()

  // Check if circuit is open
  if (circuit.state === 'open') {
    // Check if we should try half-open
    if (now - circuit.lastFailure >= opts.resetTimeoutMs) {
      circuit.state = 'half-open'
      logger.info({ key }, 'Circuit breaker half-open, attempting request')
    } else {
      throw new Error(`Circuit breaker open for ${key}`)
    }
  }

  try {
    const result = await fn()
    
    // Success - reset circuit
    if (circuit.state === 'half-open') {
      logger.info({ key }, 'Circuit breaker closed after successful request')
    }
    circuit.failures = 0
    circuit.state = 'closed'
    
    return result
  } catch (error) {
    circuit.failures++
    circuit.lastFailure = now

    // Check if we should open the circuit
    if (circuit.failures >= opts.failureThreshold) {
      circuit.state = 'open'
      logger.error({ 
        key, 
        failures: circuit.failures,
        resetTimeoutMs: opts.resetTimeoutMs,
      }, 'Circuit breaker opened')
    }

    throw error
  }
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus(key: string): CircuitBreakerState | null {
  return circuitBreakers.get(key) || null
}

/**
 * Reset a circuit breaker manually
 */
export function resetCircuitBreaker(key: string): void {
  circuitBreakers.delete(key)
  logger.info({ key }, 'Circuit breaker reset')
}
