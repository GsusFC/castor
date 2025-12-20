import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { ApiErrors } from './api/response'
import { logger } from './logger'
import { env } from '@/lib/env'

// ============================================
// Rate Limiter Configuration
// ============================================

const isProduction = env.NODE_ENV === 'production'

// Usar Redis de Upstash si está configurado correctamente, sino usar memoria local
const isValidRedisConfig =
  env.UPSTASH_REDIS_REST_URL &&
  env.UPSTASH_REDIS_REST_TOKEN &&
  !env.UPSTASH_REDIS_REST_URL.includes('your-redis') &&
  !env.UPSTASH_REDIS_REST_TOKEN.includes('your-token')

const redis = isValidRedisConfig
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Advertir si no hay Redis en producción
if (isProduction && !redis) {
  console.warn('[Rate Limit] ⚠️ UPSTASH_REDIS not configured in production! Rate limiting will use in-memory fallback which does not persist across instances.')
}

// Cache en memoria para desarrollo (no persistente entre instancias)
const memoryCache = new Map<string, { count: number; resetAt: number }>()

// ============================================
// Rate Limiters por Tipo de Operación
// ============================================

// Límites generosos para APIs normales
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : null

// Límites estrictos para operaciones costosas (crear signer, publicar)
export const expensiveLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 req/min
      analytics: true,
      prefix: 'ratelimit:expensive',
    })
  : null

// Límites para auth (prevenir brute force)
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 intentos/min
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : null

// ============================================
// Rate Limit Helper
// ============================================

type LimiterType = 'api' | 'expensive' | 'auth'

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Verifica rate limit para un identificador
 * En desarrollo sin Redis, usa límites en memoria más permisivos
 */
export async function checkRateLimit(
  identifier: string,
  type: LimiterType = 'api'
): Promise<RateLimitResult> {
  const limiter = type === 'expensive' 
    ? expensiveLimiter 
    : type === 'auth' 
      ? authLimiter 
      : apiLimiter

  // Si tenemos Redis configurado, usar Upstash
  if (limiter) {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  }

  // Fallback: rate limiting en memoria para desarrollo
  const limits: Record<LimiterType, { max: number; windowMs: number }> = {
    api: { max: 100, windowMs: 60000 },
    expensive: { max: 10, windowMs: 60000 },
    auth: { max: 5, windowMs: 60000 },
  }

  const { max, windowMs } = limits[type]
  const key = `${type}:${identifier}`
  const now = Date.now()

  const cached = memoryCache.get(key)
  
  if (!cached || cached.resetAt < now) {
    // Nueva ventana
    memoryCache.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, limit: max, remaining: max - 1, reset: now + windowMs }
  }

  if (cached.count >= max) {
    return { success: false, limit: max, remaining: 0, reset: cached.resetAt }
  }

  cached.count++
  return { success: true, limit: max, remaining: max - cached.count, reset: cached.resetAt }
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Wrapper para aplicar rate limiting a un handler
 */
export function withRateLimit(
  type: LimiterType,
  getIdentifier: (req: Request) => string
) {
  return function <T extends (...args: any[]) => Promise<NextResponse>>(handler: T): T {
    return (async (...args: Parameters<T>) => {
      const request = args[0] as Request
      const identifier = getIdentifier(request)
      
      const result = await checkRateLimit(identifier, type)

      if (!result.success) {
        logger.warn({ identifier, type, reset: result.reset }, 'Rate limit exceeded')
        
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': result.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.reset.toString(),
              'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
            },
          }
        )
      }

      const response = await handler(...args)
      
      // Añadir headers de rate limit a la respuesta
      response.headers.set('X-RateLimit-Limit', result.limit.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.reset.toString())
      
      return response
    }) as T
  }
}

/**
 * Helper para obtener IP del request
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}
