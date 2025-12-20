import { Redis } from '@upstash/redis'
import { logger } from './logger'
import { env } from '@/lib/env'

type StoredIdempotencyResponse = {
  status: number
  data: unknown
}

const isProduction = env.NODE_ENV === 'production'

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

if (isProduction && !redis) {
  console.warn(
    '[Idempotency] ⚠️ UPSTASH_REDIS not configured in production! Idempotency will use in-memory fallback which does not persist across instances.'
  )
}

const memoryCache = new Map<string, { value: string; expiresAt: number }>()

export async function getIdempotencyResponse(
  key: string
): Promise<StoredIdempotencyResponse | null> {
  const storageKey = `idem:${key}`

  if (redis) {
    const raw = await redis.get<string>(storageKey)
    if (!raw) return null

    try {
      return JSON.parse(raw) as StoredIdempotencyResponse
    } catch (error) {
      logger.warn({ storageKey, error }, 'Failed to parse idempotency response')
      return null
    }
  }

  const cached = memoryCache.get(storageKey)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(storageKey)
    return null
  }

  try {
    return JSON.parse(cached.value) as StoredIdempotencyResponse
  } catch (error) {
    logger.warn({ storageKey, error }, 'Failed to parse idempotency response (memory)')
    memoryCache.delete(storageKey)
    return null
  }
}

export async function setIdempotencyResponse(
  key: string,
  response: StoredIdempotencyResponse,
  ttlSeconds: number
): Promise<void> {
  const storageKey = `idem:${key}`
  const value = JSON.stringify(response)

  if (redis) {
    await redis.set(storageKey, value, { ex: ttlSeconds })
    return
  }

  memoryCache.set(storageKey, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}
