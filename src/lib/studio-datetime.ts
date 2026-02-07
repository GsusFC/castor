const DEFAULT_LOCALE = 'en-US'
const DEFAULT_TIME_ZONE = 'UTC'

export function getStudioLocale(): string {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }

  const language = navigator.language?.trim()
  return language || DEFAULT_LOCALE
}

export function getStudioTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

type DateInput = Date | string | number

interface FormatOptions extends Intl.DateTimeFormatOptions {
  locale?: string
  timeZone?: string
}

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input)
}

function getResolved(locale?: string, timeZone?: string) {
  return {
    locale: locale || getStudioLocale(),
    timeZone: timeZone || getStudioTimeZone(),
  }
}

export function formatStudioDate(input: DateInput, options: FormatOptions = {}): string {
  const { locale, timeZone, ...dateOptions } = options
  const resolved = getResolved(locale, timeZone)

  return toDate(input).toLocaleDateString(resolved.locale, {
    timeZone: resolved.timeZone,
    ...dateOptions,
  })
}

export function formatStudioTime(input: DateInput, options: FormatOptions = {}): string {
  const { locale, timeZone, ...timeOptions } = options
  const resolved = getResolved(locale, timeZone)

  return toDate(input).toLocaleTimeString(resolved.locale, {
    timeZone: resolved.timeZone,
    ...timeOptions,
  })
}

export function formatStudioDateTime(input: DateInput, options: FormatOptions = {}): string {
  const { locale, timeZone, ...dateTimeOptions } = options
  const resolved = getResolved(locale, timeZone)

  return toDate(input).toLocaleString(resolved.locale, {
    timeZone: resolved.timeZone,
    ...dateTimeOptions,
  })
}
