import { NextRequest, NextResponse } from 'next/server'
import { publishDueCasts } from '@/lib/publisher'
import { withLock } from '@/lib/lock'

const isProduction = process.env.NODE_ENV === 'production'
const CRON_LOCK_KEY = 'cron:publish'
const CRON_LOCK_TTL = 300 // 5 minutes max execution time

/**
 * GET /api/cron/publish
 * Endpoint para publicar casts programados
 * Llamado por Netlify Scheduled Functions o manualmente
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // En producción, CRON_SECRET es obligatorio
  if (isProduction && !cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in production!')
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    )
  }

  // Verificar secret (siempre en producción, opcional en desarrollo)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // En producción sin header, rechazar
  if (isProduction && !authHeader) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Use distributed lock to prevent concurrent executions
    const lockResult = await withLock(
      CRON_LOCK_KEY,
      async () => {
        return await publishDueCasts({
          maxCasts: 5,
          maxDurationMs: 20_000,
          publishCastTimeoutMs: 18_000,
        })
      },
      { ttlSeconds: CRON_LOCK_TTL }
    )

    if (!lockResult.success) {
      console.warn('[Cron] Another instance is already running')
      return NextResponse.json({
        success: false,
        error: 'Another cron instance is running',
        skipped: true,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      ...lockResult.result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Error publishing casts:', error)
    return NextResponse.json(
      { error: 'Failed to publish casts' },
      { status: 500 }
    )
  }
}

// También permitir POST para Netlify
export async function POST(request: NextRequest) {
  return GET(request)
}
