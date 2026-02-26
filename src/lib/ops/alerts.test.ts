import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAlertFingerprint, maybeSendDiscordAlert } from './alerts'

describe('ops alerts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns missing-webhook when webhook URL is not configured', async () => {
    const client = {
      execute: vi.fn(),
    } as any

    const result = await maybeSendDiscordAlert({
      client,
      webhookUrl: '',
      cooldownMinutes: 30,
      fingerprint: buildAlertFingerprint(['watchdog', 'x']),
      alert: {
        title: 'title',
        description: 'desc',
        severity: 'critical',
      },
    })

    expect(result.sent).toBe(false)
    expect(result.reason).toBe('missing-webhook')
    expect(client.execute).not.toHaveBeenCalled()
  })

  it('skips send while fingerprint is on cooldown', async () => {
    const now = Math.floor(Date.now() / 1000)
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ last_sent_at: now }] })

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any)

    const result = await maybeSendDiscordAlert({
      client: { execute } as any,
      webhookUrl: 'https://discord.example/webhook',
      cooldownMinutes: 30,
      fingerprint: buildAlertFingerprint(['watchdog', 'x']),
      alert: {
        title: 'title',
        description: 'desc',
        severity: 'warning',
      },
    })

    expect(result.sent).toBe(false)
    expect(result.reason).toBe('cooldown')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends webhook and persists alert state', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: true, status: 204 } as any)

    const result = await maybeSendDiscordAlert({
      client: { execute } as any,
      webhookUrl: 'https://discord.example/webhook',
      cooldownMinutes: 30,
      fingerprint: buildAlertFingerprint(['watchdog', 'healthy']),
      alert: {
        title: 'title',
        description: 'desc',
        severity: 'info',
        details: ['line 1'],
      },
    })

    expect(result.sent).toBe(true)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
