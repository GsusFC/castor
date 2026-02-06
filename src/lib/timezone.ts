/**
 * Timezone-aware date utilities for v2.
 * Uses the browser's timezone instead of hardcoding Europe/Madrid.
 */

/** Get the user's browser timezone (e.g. "America/New_York") */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/** Convert a date string (YYYY-MM-DD) and time string (HH:MM) to ISO, respecting the user's timezone */
export function toLocalISO(date: string, time: string, timezone?: string): string {
  const tz = timezone || getUserTimezone()
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  // Build a UTC timestamp for the given date/time
  const localMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  // Get the timezone offset for that moment
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(localMillis), tz)
  const utcMillis = localMillis - offsetMinutes * 60_000

  return new Date(utcMillis).toISOString()
}

/** Convert an ISO string back to { date, time } in the user's timezone */
export function fromISO(isoString: string, timezone?: string): { date: string; time: string } {
  const tz = timezone || getUserTimezone()
  const dateObj = new Date(isoString)

  const date = dateObj.toLocaleDateString('en-CA', { timeZone: tz })
  const time = dateObj.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  })

  return { date, time }
}

/** Format a date for display in the user's timezone */
export function formatScheduleLabel(date: string, time: string, timezone?: string): string {
  const tz = timezone || getUserTimezone()
  const dateObj = new Date(`${date}T${time}`)

  return dateObj.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  })
}

// ─── Internal ────────────────────────────────────────────────────────────────

function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  })
  const parts = formatter.formatToParts(date)
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
  return parseOffsetMinutes(tzName)
}

function parseOffsetMinutes(tzLabel: string): number {
  const match = tzLabel.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  return hours * 60 + Math.sign(hours) * minutes
}
