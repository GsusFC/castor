import { NextRequest, NextResponse } from 'next/server'
import { publishDueCasts } from '@/lib/publisher'
import { withLock } from '@/lib/lock'
import { env } from '@/lib/env'
import { db, cronRuns } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const isProduction = env.NODE_ENV === 'production'
const CRON_LOCK_KEY = 'cron:publish'
const CRON_LOCK_TTL = 300 // 5 minutes max execution time
type CronSource = 'netlify-scheduled' | 'manual' | 'watchdog-check'

async function createRun(jobName: 'publish_due_casts', source: CronSource): Promise<string | null> {
  const id = generateId()
  try {
    await db.insert(cronRuns).values({
      id,
      jobName,
      startedAt: new Date(),
      success: false,
      source,
    })
    return id
  } catch (error) {
    console.error('[Cron] Failed to create cron_runs record:', error)
    return null
  }
}

async function completeRun(
  runId: string | null,
  update: {
    success: boolean
    published?: number
    failed?: number
    retrying?: number
    skipped?: number
    processed?: number
    errorMessage?: string | null
  }
) {
  if (!runId) return

  try {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        success: update.success,
        published: update.published,
        failed: update.failed,
        retrying: update.retrying,
        skipped: update.skipped,
        processed: update.processed,
        errorMessage: update.errorMessage ?? null,
      })
      .where(eq(cronRuns.id, runId))
  } catch (error) {
    console.error('[Cron] Failed to update cron_runs record:', error)
  }
}

/**
 * GET /api/cron/publish
 * Endpoint para publicar casts programados
 * Llamado por Netlify Scheduled Functions o manualmente
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = env.CRON_SECRET
  const sourceHeader = request.headers.get('x-cron-source')
  const source: CronSource =
    sourceHeader === 'netlify-scheduled' || sourceHeader === 'watchdog-check'
      ? sourceHeader
      : 'manual'
  const runId = await createRun('publish_due_casts', source)

  // En producción, CRON_SECRET es obligatorio
  if (isProduction && !cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in production!')
    await completeRun(runId, { success: false, errorMessage: 'CRON_SECRET not configured in production' })
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    )
  }

  // Verificar secret (siempre en producción, opcional en desarrollo)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    await completeRun(runId, { success: false, errorMessage: 'Unauthorized: invalid cron secret' })
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // En producción sin header, rechazar
  if (isProduction && !authHeader) {
    await completeRun(runId, { success: false, errorMessage: 'Unauthorized: missing authorization header' })
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
      await completeRun(runId, {
        success: false,
        errorMessage: 'Another cron instance is running',
      })
      return NextResponse.json({
        success: false,
        error: 'Another cron instance is running',
        skipped: true,
        timestamp: new Date().toISOString(),
      })
    }

    await completeRun(runId, {
      success: true,
      published: lockResult.result.published,
      failed: lockResult.result.failed,
      retrying: lockResult.result.retrying,
      skipped: lockResult.result.skipped,
      processed: lockResult.result.processed,
      errorMessage: null,
    })

    return NextResponse.json({
      success: true,
      ...lockResult.result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Error publishing casts:', error)
    await completeRun(runId, {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Failed to publish casts',
    })
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
