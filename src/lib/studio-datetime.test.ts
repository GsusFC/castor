import { describe, expect, it } from 'vitest'
import { formatStudioDate, formatStudioTime } from './studio-datetime'

describe('studio-datetime', () => {
  it('formats date with explicit locale/timezone', () => {
    const iso = '2026-02-02T08:30:00.000Z'
    const formatted = formatStudioDate(iso, {
      locale: 'en-GB',
      timeZone: 'Europe/Madrid',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

    expect(formatted).toContain('Mon')
    expect(formatted).toContain('Feb')
  })

  it('formats time with explicit timezone', () => {
    const iso = '2026-02-02T08:30:00.000Z'
    const formatted = formatStudioTime(iso, {
      locale: 'en-US',
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
    })

    expect(formatted).toMatch(/03:30|3:30/)
  })
})
