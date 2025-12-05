const timeZone = 'Europe/Madrid'

const parseOffsetMinutes = (tzLabel: string): number => {
  const match = tzLabel.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  return hours * 60 + Math.sign(hours) * minutes
}

const getOffsetMinutes = (date: Date): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  })
  const parts = formatter.formatToParts(date)
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
  return parseOffsetMinutes(tzName)
}

export const toMadridISO = (date: string, time: string): string => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const localMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  const offsetMinutes = getOffsetMinutes(new Date(localMillis))
  const utcMillis = localMillis - offsetMinutes * 60_000

  return new Date(utcMillis).toISOString()
}
