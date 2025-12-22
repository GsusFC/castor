import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const configuredPort = process.env.PORT

const buildBaseUrl = (p) => `http://localhost:${p}`

const exec = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `__ERROR__:${message}`
  }
}

const exists = (p) => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

const checkEnvVar = (key) => {
  const value = process.env[key]
  if (!value) return { key, present: false, length: 0 }
  return { key, present: true, length: value.length }
}

const fetchJson = async (url, timeoutMs = 5000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const start = Date.now()

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })

    const latencyMs = Date.now() - start
    const bodyText = await res.text()

    try {
      return { ok: res.ok, status: res.status, latencyMs, json: JSON.parse(bodyText), bodyText }
    } catch {
      return { ok: res.ok, status: res.status, latencyMs, bodyText }
    }
  } finally {
    clearTimeout(timeout)
  }
}

const isValidHealthResponse = (result) => {
  if (!result) return false
  if (result.status !== 200 && result.status !== 503) return false
  if (!result.json || typeof result.json !== 'object') return false
  const status = result.json.status
  return status === 'healthy' || status === 'degraded' || status === 'unhealthy'
}

const discoverPort = async () => {
  const candidates = []
  if (configuredPort) candidates.push(configuredPort)
  for (let p = 3000; p <= 3010; p++) {
    const s = String(p)
    if (!candidates.includes(s)) candidates.push(s)
  }

  for (const p of candidates) {
    const url = `${buildBaseUrl(p)}/api/health`
    try {
      const res = await fetchJson(url, 1200)
      if (isValidHealthResponse(res)) return { port: p, health: res }
    } catch {
      // ignore
    }
  }

  const fallbackPort = configuredPort || '3000'
  return { port: fallbackPort, health: null }
}

const printSection = (title) => {
  process.stdout.write(`\n${title}\n`)
  process.stdout.write(`${'-'.repeat(Math.max(8, title.length))}\n`)
}

printSection('Healthcheck')
process.stdout.write(`cwd: ${cwd}\n`)

const discovered = await discoverPort()
const port = discovered.port
const baseUrl = buildBaseUrl(port)

process.stdout.write(`url: ${baseUrl}\n`)
if (configuredPort && configuredPort !== port) {
  process.stdout.write(`note: PORT env=${configuredPort} but detected server on ${port}\n`)
}

printSection('Port')
const lsofOut = exec(`lsof -nP -iTCP:${port} -sTCP:LISTEN`)
if (lsofOut.startsWith('__ERROR__:')) {
  process.stdout.write(`No listener detected on port ${port}\n`)
} else {
  const lines = lsofOut.split('\n').filter(Boolean)
  if (lines.length <= 1) {
    process.stdout.write(`No listener detected on port ${port}\n`)
  } else {
    const first = lines[1]
    process.stdout.write(`Listener on port ${port}:\n${first}\n`)
    const parts = first.trim().split(/\s+/)
    const pid = parts[1]
    if (pid && /^\d+$/.test(pid)) {
      const psOut = exec(`ps -p ${pid} -o command=`)
      if (!psOut.startsWith('__ERROR__:')) {
        process.stdout.write(`command: ${psOut}\n`)
      }
    }
  }
}

printSection('Next dev lock')
const devLockPath = path.join(cwd, '.next', 'dev', 'lock')
process.stdout.write(`.next/dev/lock: ${exists(devLockPath) ? 'present (try npm run dev:clean)' : 'absent'}\n`)

printSection('Environment')
const envKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'DATABASE_AUTH_TOKEN',
  'NEYNAR_API_KEY',
  'SESSION_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_IMAGES_API_KEY',
  'GEMINI_API_KEY',
]

for (const key of envKeys) {
  if (key === 'NODE_ENV') {
    process.stdout.write(`${key}: ${process.env.NODE_ENV || 'development'}\n`)
    continue
  }

  const info = checkEnvVar(key)
  if (!info.present) {
    process.stdout.write(`${key}: missing\n`)
    continue
  }

  process.stdout.write(`${key}: present (len=${info.length})\n`)
}

printSection('HTTP')
const healthUrl = `${baseUrl}/api/health`
process.stdout.write(`GET ${healthUrl}\n`)

try {
  const result = discovered.health ?? (await fetchJson(healthUrl, 8000))
  if (!isValidHealthResponse(result)) {
    const status = result?.status ?? 'unknown'
    const latencyMs = result?.latencyMs ?? 'unknown'
    process.stdout.write(`health: FAIL status=${status} latencyMs=${latencyMs}\n`)
    if (typeof result?.bodyText === 'string' && result.bodyText.length > 0) {
      process.stdout.write(`body: ${result.bodyText.slice(0, 500)}\n`)
    }
    process.exitCode = 1
  } else {
    process.stdout.write(`health: OK status=${result.status} latencyMs=${result.latencyMs}\n`)
    if (result.json?.status) {
      process.stdout.write(`overall: ${result.json.status}\n`)
    }
    if (result.json?.checks) {
      for (const [k, v] of Object.entries(result.json.checks)) {
        const status = v?.status ? String(v.status) : 'unknown'
        const latency = typeof v?.latencyMs === 'number' ? `${v.latencyMs}ms` : ''
        const err = v?.error ? `error=${String(v.error)}` : ''
        process.stdout.write(`check.${k}: ${status} ${latency} ${err}`.trimEnd() + '\n')
      }
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stdout.write(`health: ERROR ${message}\n`)
  process.exitCode = 1
}
