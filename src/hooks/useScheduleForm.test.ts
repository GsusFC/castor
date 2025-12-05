import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScheduleForm } from './useScheduleForm'

describe('useScheduleForm', () => {
  it('inicia con valores vacíos', () => {
    const { result } = renderHook(() => useScheduleForm())

    expect(result.current.date).toBe('')
    expect(result.current.time).toBe('')
    expect(result.current.isValid).toBe(false)
  })

  it('actualiza fecha y hora', () => {
    const { result } = renderHook(() => useScheduleForm())

    act(() => {
      result.current.setDate('2024-01-15')
      result.current.setTime('09:30')
    })

    expect(result.current.date).toBe('2024-01-15')
    expect(result.current.time).toBe('09:30')
    expect(result.current.isValid).toBe(true)
  })

  it('reset limpia valores', () => {
    const { result } = renderHook(() => useScheduleForm())

    act(() => {
      result.current.setDate('2024-01-15')
      result.current.setTime('09:30')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.date).toBe('')
    expect(result.current.time).toBe('')
    expect(result.current.isValid).toBe(false)
  })

  it('toISO devuelve null si no es válido', () => {
    const { result } = renderHook(() => useScheduleForm())

    expect(result.current.toISO()).toBeNull()
  })

  it('toISO devuelve ISO string válido', () => {
    const { result } = renderHook(() => useScheduleForm())

    act(() => {
      result.current.setDate('2024-01-15')
      result.current.setTime('09:30')
    })

    const iso = result.current.toISO()
    expect(iso).not.toBeNull()
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
  })

  it('setFromISO parsea correctamente', () => {
    const { result } = renderHook(() => useScheduleForm())

    act(() => {
      result.current.setFromISO('2024-07-15T07:30:00.000Z')
    })

    expect(result.current.date).toBe('2024-07-15')
    expect(result.current.time).toBe('09:30')
    expect(result.current.isValid).toBe(true)
  })
})
