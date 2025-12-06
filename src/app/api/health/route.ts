import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { fetchWithTimeout, DEFAULT_TIMEOUTS } from '@/lib/fetch'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
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
    const response = await fetchWithTimeout('https://api.neynar.com/v2/farcaster/user/bulk?fids=1', {
      headers: { 'api_key': process.env.NEYNAR_API_KEY || '' },
      timeoutMs: DEFAULT_TIMEOUTS.HEALTH,
    })
    
    if (!response.ok) {
      return { status: 'error', latencyMs: Date.now() - start, error: `HTTP ${response.status}` }
    }
    
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (error) {
    return { 
      status: 'error', 
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkCloudflare(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const response = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream`,
      {
        headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_IMAGES_API_KEY}` },
        timeoutMs: DEFAULT_TIMEOUTS.HEALTH,
      }
    )
    
    if (!response.ok) {
      return { status: 'error', latencyMs: Date.now() - start, error: `HTTP ${response.status}` }
    }
    
    return { status: 'ok', latencyMs: Date.now() - start }
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
    checks,
  }

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200

  return NextResponse.json(health, { status: httpStatus })
}
