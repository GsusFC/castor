import type { Config, Context, Handler } from '@netlify/functions'
import { createClient } from '@libsql/client/http'
import crypto from 'crypto'
import { buildAlertFingerprint, maybeSendDiscordAlert } from '../../src/lib/ops/alerts'

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000)
}

function createRunId(): string {
  return crypto.randomBytes(11).toString('hex')
}

function resolveSiteUrl(ctx: Context): string {
  return (
    (ctx as any)?.site?.url ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '')
}

export const handler: Handler = async (_event, context) => {
  const dbUrl = process.env.DATABASE_URL
  const dbAuthToken = process.env.DATABASE_AUTH_TOKEN
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
  const nodeEnv = process.env.NODE_ENV || 'development'

  const heartbeatMinutes = getEnvNumber('CRON_WATCHDOG_HEARTBEAT_MINUTES', 3)
  const overdueMinutes = getEnvNumber('CRON_WATCHDOG_OVERDUE_MINUTES', 10)
  const alertCooldownMinutes = getEnvNumber('CRON_ALERT_COOLDOWN_MINUTES', 30)

  if (!dbUrl) {
    console.error('[Cron Watchdog] DATABASE_URL is missing')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'DATABASE_URL is missing' }),
    }
  }

  const client = createClient({
    url: dbUrl,
    authToken: dbAuthToken,
  })

  const runId = createRunId()
  const startedAt = new Date()

  const completeRun = async (success: boolean, errorMessage: string | null) => {
    try {
      await client.execute({
        sql: `
          UPDATE cron_runs
          SET success = ?, finished_at = ?, error_message = ?
          WHERE id = ?
        `,
        args: [success ? 1 : 0, Math.floor(Date.now() / 1000), errorMessage, runId],
      })
    } catch (error) {
      console.error('[Cron Watchdog] Failed to update cron run:', error)
    }
  }

  try {
    await client.execute({
      sql: `
        INSERT INTO cron_runs (id, job_name, started_at, success, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [runId, 'watchdog', Math.floor(startedAt.getTime() / 1000), 0, 'watchdog-check', Math.floor(startedAt.getTime() / 1000)],
    })
  } catch (error) {
    console.error('[Cron Watchdog] Failed to insert cron run:', error)
  }

  try {
    const now = unixNow()
    const heartbeatCutoff = now - heartbeatMinutes * 60
    const overdueCutoff = now - overdueMinutes * 60

    const lastSuccessResult = await client.execute(`
      SELECT finished_at
      FROM cron_runs
      WHERE job_name = 'publish_due_casts' AND success = 1
      ORDER BY finished_at DESC
      LIMIT 1
    `)

    const lastSuccessFinishedAt = lastSuccessResult.rows?.[0]?.finished_at
      ? Number(lastSuccessResult.rows[0].finished_at)
      : null

    const overdueCountResult = await client.execute({
      sql: `
        SELECT COUNT(*) AS total
        FROM scheduled_casts
        WHERE status IN ('scheduled', 'retrying') AND scheduled_at <= ?
      `,
      args: [overdueCutoff],
    })

    const overdueCount = Number(overdueCountResult.rows?.[0]?.total ?? 0)

    const overdueRowsResult = await client.execute({
      sql: `
        SELECT id, scheduled_at
        FROM scheduled_casts
        WHERE status IN ('scheduled', 'retrying') AND scheduled_at <= ?
        ORDER BY scheduled_at ASC
        LIMIT 10
      `,
      args: [overdueCutoff],
    })

    const overdueRows = overdueRowsResult.rows || []
    const oldestOverdueAt = overdueRows.length > 0 ? Number(overdueRows[0]?.scheduled_at || now) : null
    const maxOverdueMinutes = oldestOverdueAt ? Math.max(0, Math.floor((now - oldestOverdueAt) / 60)) : 0

    const issues: string[] = []

    if (!lastSuccessFinishedAt || lastSuccessFinishedAt < heartbeatCutoff) {
      issues.push('publish_heartbeat_stale')
    }

    if (overdueCount > 0) {
      issues.push('overdue_scheduled_casts')
    }

    if (issues.length === 0) {
      await completeRun(true, null)
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          healthy: true,
          checks: {
            heartbeatMinutes,
            overdueMinutes,
            overdueCount,
          },
          timestamp: new Date().toISOString(),
        }),
      }
    }

    const siteUrl = resolveSiteUrl(context as unknown as Context)
    const remediationUrl = siteUrl ? `${siteUrl}/api/cron/publish` : '/api/cron/publish'

    const fingerprint = buildAlertFingerprint(['cron-watchdog', ...issues])

    const alertDetails = [
      !lastSuccessFinishedAt
        ? 'No successful publish cron run recorded yet.'
        : `Last successful publish run at ${new Date(lastSuccessFinishedAt * 1000).toISOString()} UTC.`,
      `Overdue casts count: ${overdueCount}.`,
      ...(overdueRows.length > 0
        ? [`Affected cast IDs: ${overdueRows.map((row) => String(row.id)).join(', ')}`]
        : []),
      ...(maxOverdueMinutes > 0 ? [`Max overdue age: ${maxOverdueMinutes} minutes.`] : []),
      `Manual remediation: ${remediationUrl}`,
    ]

    const sendResult = await maybeSendDiscordAlert({
      client,
      webhookUrl: discordWebhookUrl,
      cooldownMinutes: alertCooldownMinutes,
      fingerprint,
      alert: {
        title: 'Castor Cron Watchdog Alert',
        description: 'Detected issues in scheduled cast publishing pipeline.',
        severity: 'critical',
        details: alertDetails,
        metadata: {
          environment: nodeEnv,
          issues: issues.join(','),
          heartbeatMinutes,
          overdueMinutes,
        },
      },
    })

    if (sendResult.reason === 'missing-webhook' && nodeEnv === 'production') {
      console.error('[Cron Watchdog] DISCORD_WEBHOOK_URL is missing in production')
    }

    const runErrorMessage = sendResult.sent
      ? `watchdog issues: ${issues.join(',')}`
      : `watchdog issues: ${issues.join(',')} (alert=${sendResult.reason || 'not-sent'})`

    await completeRun(false, runErrorMessage)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        healthy: false,
        issues,
        alertSent: sendResult.sent,
        alertReason: sendResult.reason || null,
        overdueCount,
        maxOverdueMinutes,
        timestamp: new Date().toISOString(),
      }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.error('[Cron Watchdog] Error:', error)
    await completeRun(false, message)

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'watchdog_failed',
        message,
      }),
    }
  } finally {
    await client.close()
  }
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
