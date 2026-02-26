import type { Client } from '@libsql/client/http'
import crypto from 'crypto'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface DiscordAlertInput {
  title: string
  description: string
  severity: AlertSeverity
  details?: string[]
  metadata?: Record<string, string | number | boolean | null | undefined>
  timestampIso?: string
}

export interface SendDiscordAlertOptions {
  client: Client
  webhookUrl?: string
  cooldownMinutes: number
  fingerprint: string
  alert: DiscordAlertInput
}

export interface SendDiscordAlertResult {
  sent: boolean
  reason?: 'cooldown' | 'missing-webhook'
}

const severityColor: Record<AlertSeverity, number> = {
  info: 0x5865f2,
  warning: 0xf1c40f,
  critical: 0xed4245,
}

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function buildAlertFingerprint(parts: Array<string | number | null | undefined>): string {
  const normalized = parts.map((part) => String(part ?? '')).join('|')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

async function isOnCooldown(
  client: Client,
  fingerprint: string,
  cooldownMinutes: number
): Promise<boolean> {
  const res = await client.execute({
    sql: 'SELECT last_sent_at FROM ops_alerts WHERE fingerprint = ? LIMIT 1',
    args: [fingerprint],
  })

  const row = res.rows?.[0]
  if (!row?.last_sent_at) return false

  const lastSentAt = Number(row.last_sent_at)
  if (!Number.isFinite(lastSentAt)) return false

  const cooldownSeconds = Math.max(0, cooldownMinutes) * 60
  return nowUnixSeconds() - lastSentAt < cooldownSeconds
}

async function saveAlertState(client: Client, fingerprint: string, payload: string): Promise<void> {
  const now = nowUnixSeconds()
  await client.execute({
    sql: `
      INSERT INTO ops_alerts (fingerprint, last_sent_at, last_payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(fingerprint)
      DO UPDATE SET
        last_sent_at = excluded.last_sent_at,
        last_payload = excluded.last_payload,
        updated_at = excluded.updated_at
    `,
    args: [fingerprint, now, payload, now, now],
  })
}

function buildDiscordPayload(alert: DiscordAlertInput): string {
  const lines: string[] = []

  if (alert.details && alert.details.length > 0) {
    lines.push(...alert.details.map((line) => `- ${line}`))
  }

  const metadataEntries = Object.entries(alert.metadata || {}).filter(([, value]) => value !== undefined)
  if (metadataEntries.length > 0) {
    lines.push('')
    lines.push(...metadataEntries.map(([key, value]) => `**${key}:** ${String(value)}`))
  }

  return JSON.stringify({
    embeds: [
      {
        title: alert.title,
        description: [alert.description, ...lines].join('\n').trim(),
        color: severityColor[alert.severity],
        timestamp: alert.timestampIso || new Date().toISOString(),
      },
    ],
  })
}

export async function maybeSendDiscordAlert(options: SendDiscordAlertOptions): Promise<SendDiscordAlertResult> {
  const { client, webhookUrl, cooldownMinutes, fingerprint, alert } = options

  if (!webhookUrl) {
    return { sent: false, reason: 'missing-webhook' }
  }

  const onCooldown = await isOnCooldown(client, fingerprint, cooldownMinutes)
  if (onCooldown) {
    return { sent: false, reason: 'cooldown' }
  }

  const payload = buildDiscordPayload(alert)

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
  })

  if (!response.ok) {
    throw new Error(`Discord webhook failed with status ${response.status}`)
  }

  await saveAlertState(client, fingerprint, payload)
  return { sent: true }
}
