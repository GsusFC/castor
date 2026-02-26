#!/usr/bin/env node

const args = process.argv.slice(2)

const getArg = (name) => {
  const i = args.findIndex((a) => a === name)
  if (i === -1) return undefined
  return args[i + 1]
}

const baseUrlRaw = getArg('--base-url') || process.env.SMOKE_BASE_URL
const cronSecret = getArg('--cron-secret') || process.env.CRON_SECRET

if (!baseUrlRaw) {
  console.error('Missing --base-url or SMOKE_BASE_URL')
  process.exit(1)
}

const baseUrl = baseUrlRaw.replace(/\/$/, '')

const fetchJson = async (url, init) => {
  const startedAt = Date.now()
  const response = await fetch(url, init)
  const bodyText = await response.text()
  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    body = bodyText
  }
  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Date.now() - startedAt,
    body,
  }
}

const run = async () => {
  const healthUrl = `${baseUrl}/api/health?ts=${Date.now()}`
  const health = await fetchJson(healthUrl)

  if (!health.ok) {
    console.error(`[SMOKE] health failed: status=${health.status}`)
    console.error(health.body)
    process.exit(1)
  }

  console.log(`[SMOKE] health ok (${health.latencyMs}ms)`)

  if (!cronSecret) {
    console.error('[SMOKE] Missing CRON_SECRET for /api/cron/publish check')
    process.exit(1)
  }

  const cronUrl = `${baseUrl}/api/cron/publish?ts=${Date.now()}`
  const cron = await fetchJson(cronUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'x-cron-source': 'watchdog-check',
    },
  })

  if (!cron.ok) {
    console.error(`[SMOKE] cron publish failed: status=${cron.status}`)
    console.error(cron.body)
    process.exit(1)
  }

  if (!cron.body || cron.body.success !== true) {
    console.error('[SMOKE] cron publish returned unexpected payload')
    console.error(cron.body)
    process.exit(1)
  }

  console.log(`[SMOKE] cron publish ok (${cron.latencyMs}ms)`)
  console.log('[SMOKE] all checks passed')
}

run().catch((error) => {
  console.error('[SMOKE] unexpected error', error)
  process.exit(1)
})
