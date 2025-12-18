import type { Config, Context, Handler } from '@netlify/functions'

/**
 * Netlify Scheduled Function
 * Se ejecuta cada minuto para publicar casts programados
 */
export const handler: Handler = async (_event, context) => {
  const ctx = context as unknown as Context

  const siteUrl =
    (ctx as any).site?.url ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    ''
  const cronSecret = process.env.CRON_SECRET || ''

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    if (!siteUrl) {
      console.error('[Netlify Cron] Missing site URL in function runtime')
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing site URL' }),
      }
    }

    if (!cronSecret) {
      console.warn('[Netlify Cron] CRON_SECRET is empty')
    }

    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 25_000)

    const cronUrl = `${siteUrl.replace(/\/$/, '')}/api/cron/publish`
    const response = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    const rawBody = await response.text()
    let parsed: unknown = null
    try {
      parsed = rawBody.length > 0 ? (JSON.parse(rawBody) as unknown) : null
    } catch {
      parsed = null
    }

    console.log('[Netlify Cron] Publish response:', {
      cronUrl,
      status: response.status,
      ok: response.ok,
      isJson: parsed !== null,
      bodyPreview: rawBody.slice(0, 500),
    })

    const payload = parsed ?? {
      error: 'Invalid JSON response from /api/cron/publish',
      status: response.status,
      bodyPreview: rawBody.slice(0, 500),
    }

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    console.error('[Netlify Cron] Error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: isAbort ? 'Cron request timed out' : 'Failed to trigger publish',
      }),
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

// Ejecutar cada minuto
export const config: Config = {
  schedule: '* * * * *', // Cada minuto
}
