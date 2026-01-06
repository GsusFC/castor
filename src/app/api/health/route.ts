import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { fetchWithTimeout, DEFAULT_TIMEOUTS } from '@/lib/fetch'
import { getCircuitBreakerStatus } from '@/lib/retry'
import { env, requireNeynarEnv } from '@/lib/env'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  config: {
    databaseUrlConfigured: boolean
    neynarConfigured: boolean
    cloudflareConfigured: boolean
  }
  circuitBreakers: Record<string, { state: string; failures: number; lastFailure: number } | null>
  checks: {
    database: CheckResult
    neynar: CheckResult
    cloudflare: CheckResult
  }
}

interface CheckResult {
  status: 'ok' | 'error'
  latencyMs?: number
  error?: string
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    // Simple query to verify DB connection
    await db.select().from(users).limit(1)
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (error) {
    return { 
      status: 'error', 
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkNeynar(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { NEYNAR_API_KEY } = requireNeynarEnv()
    const response = await fetchWithTimeout('https://api.neynar.com/v2/farcaster/user/bulk?fids=1', {
      headers: { 'api_key': NEYNAR_API_KEY },
      timeoutMs: DEFAULT_TIMEOUTS.HEALTH,
    })
    
    if (!response.ok) {
      return { status: 'error', latencyMs: Date.now() - start, error: `HTTP ${response.status}` }
    }
    
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEYNAR_API_KEY is required') {
      return { status: 'error', error: 'Not configured' }
    }
    return { 
      status: 'error', 
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkCloudflare(): Promise<CheckResult> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_IMAGES_API_KEY) {
    return { status: 'error', error: 'Not configured' }
  }

  const start = Date.now()
  try {
    const response = await fetchWithTimeout(
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      {
        headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_IMAGES_API_KEY}` },
        timeoutMs: DEFAULT_TIMEOUTS.HEALTH,
      }
    )

    const latencyMs = Date.now() - start
    const body = await response.json().catch(() => null)

    if (!response.ok) {
      const errors =
        body && typeof body === 'object'
          ? (body as { errors?: Array<{ message?: string }> }).errors
          : undefined

      const errorMessage =
        Array.isArray(errors) && errors.length > 0 && errors[0]?.message
          ? String(errors[0].message)
          : `HTTP ${response.status}`

      return { status: 'error', latencyMs, error: errorMessage }
    }

    if (body && typeof body === 'object' && 'success' in body && body.success === false) {
      return { status: 'error', latencyMs, error: 'Cloudflare token verification failed' }
    }

    return { status: 'ok', latencyMs }
  } catch (error) {
    return { 
      status: 'error', 
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * GET /api/health
 * Health check endpoint para monitoreo
 */
export async function GET() {
  const [database, neynar, cloudflare] = await Promise.all([
    checkDatabase(),
    checkNeynar(),
    checkCloudflare(),
  ])

  const checks = { database, neynar, cloudflare }
  const allOk = Object.values(checks).every(c => c.status === 'ok')
  const anyError = Object.values(checks).some(c => c.status === 'error')

  let overallStatus: HealthCheck['status']
  if (allOk) {
    overallStatus = 'healthy'
  } else if (database.status === 'error') {
    // DB es crítico
    overallStatus = 'unhealthy'
  } else if (anyError) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'healthy'
  }

  const health: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    config: {
      databaseUrlConfigured: !!env.DATABASE_URL,
      neynarConfigured: !!env.NEYNAR_API_KEY,
      cloudflareConfigured: !!env.CLOUDFLARE_ACCOUNT_ID && !!env.CLOUDFLARE_IMAGES_API_KEY,
    },
    circuitBreakers: {
      'neynar:feed:trending': getCircuitBreakerStatus('neynar:feed:trending'),
      'neynar:feed:for-you': getCircuitBreakerStatus('neynar:feed:for-you'),
      'neynar:feed:following': getCircuitBreakerStatus('neynar:feed:following'),
      'neynar:feed:channel': getCircuitBreakerStatus('neynar:feed:channel'),
      'neynar:notifications': getCircuitBreakerStatus('neynar:notifications'),
      'neynar:channels:search': getCircuitBreakerStatus('neynar:channels:search'),
      'neynar:channels:trending': getCircuitBreakerStatus('neynar:channels:trending'),
      'neynar:channels:lookup': getCircuitBreakerStatus('neynar:channels:lookup'),
      'neynar:channels:memberships': getCircuitBreakerStatus('neynar:channels:memberships'),
      'neynar:social:followers': getCircuitBreakerStatus('neynar:social:followers'),
      'neynar:social:following': getCircuitBreakerStatus('neynar:social:following'),
      'neynar:users:lookup': getCircuitBreakerStatus('neynar:users:lookup'),
      'neynar:users:search': getCircuitBreakerStatus('neynar:users:search'),
      'neynar:casts:lookup': getCircuitBreakerStatus('neynar:casts:lookup'),
      'neynar:casts:conversation': getCircuitBreakerStatus('neynar:casts:conversation'),
      'neynar:search:casts': getCircuitBreakerStatus('neynar:search:casts'),
      'neynar:search:users': getCircuitBreakerStatus('neynar:search:users'),
      'neynar:search:channels': getCircuitBreakerStatus('neynar:search:channels'),
    },
    checks,
  }

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200

  const res = NextResponse.json(health, { status: httpStatus })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
