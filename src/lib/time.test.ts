import { describe, expect, it } from 'vitest'
import { toMadridISO } from './time'

describe('toMadridISO', () => {
  it('convierte fecha invernal (UTC+1) a ISO', () => {
    const iso = toMadridISO('2024-01-15', '09:30')
    expect(iso).toBe('2024-01-15T08:30:00.000Z')
  })

  it('convierte fecha veraniega (UTC+2) a ISO', () => {
    const iso = toMadridISO('2024-07-15', '09:30')
    expect(iso).toBe('2024-07-15T07:30:00.000Z')
  })
})
