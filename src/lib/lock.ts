/**
 * Distributed locking for preventing duplicate operations
 * Uses Redis if available, falls back to in-memory (single instance only)
 */

import { Redis } from '@upstash/redis'
import { logger } from './logger'

const isValidRedisConfig =
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  !process.env.UPSTASH_REDIS_REST_URL.includes('your-redis') &&
  !process.env.UPSTASH_REDIS_REST_TOKEN.includes('your-token')

const redis = isValidRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// In-memory fallback (only works for single instance)
const memoryLocks = new Map<string, { expiresAt: number; owner: string }>()

/**
 * Acquires a distributed lock
 * @returns Lock ID if acquired, null if lock already held
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number = 60
): Promise<string | null> {
  const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const lockKey = `lock:${key}`

  if (redis) {
    // Redis-based lock using SET NX EX
    const acquired = await redis.set(lockKey, lockId, {
      nx: true,
      ex: ttlSeconds,
    })
    
    if (acquired) {
      logger.debug({ key, lockId, ttlSeconds }, 'Lock acquired (Redis)')
      return lockId
    }
    return null
  }

  // Memory-based fallback
  const now = Date.now()
  const existing = memoryLocks.get(lockKey)
  
  if (existing && existing.expiresAt > now) {
    // Lock still held
    return null
  }

  // Acquire lock
  memoryLocks.set(lockKey, {
    expiresAt: now + ttlSeconds * 1000,
    owner: lockId,
  })
  
  logger.debug({ key, lockId, ttlSeconds }, 'Lock acquired (memory)')
  return lockId
}

/**
 * Releases a distributed lock
 * Only releases if we own the lock
 */
export async function releaseLock(key: string, lockId: string): Promise<boolean> {
  const lockKey = `lock:${key}`

  if (redis) {
    // Only delete if we own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    const result = await redis.eval(script, [lockKey], [lockId])
    const released = result === 1
    
    if (released) {
      logger.debug({ key, lockId }, 'Lock released (Redis)')
    }
    return released
  }

  // Memory-based fallback
  const existing = memoryLocks.get(lockKey)
  
  if (existing && existing.owner === lockId) {
    memoryLocks.delete(lockKey)
    logger.debug({ key, lockId }, 'Lock released (memory)')
    return true
  }
  
  return false
}

/**
 * Executes a function while holding a lock
 * Automatically releases lock when done
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: { ttlSeconds?: number; waitMs?: number; maxRetries?: number } = {}
): Promise<{ success: true; result: T } | { success: false; reason: 'locked' }> {
  const { ttlSeconds = 60, waitMs = 100, maxRetries = 0 } = options
  
  let lockId: string | null = null
  let attempts = 0

  // Try to acquire lock
  while (attempts <= maxRetries) {
    lockId = await acquireLock(key, ttlSeconds)
    if (lockId) break
    
    if (attempts < maxRetries) {
      await new Promise(r => setTimeout(r, waitMs))
    }
    attempts++
  }

  if (!lockId) {
    logger.warn({ key, attempts }, 'Could not acquire lock')
    return { success: false, reason: 'locked' }
  }

  try {
    const result = await fn()
    return { success: true, result }
  } finally {
    await releaseLock(key, lockId)
  }
}
