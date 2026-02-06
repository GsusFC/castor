'use client'

import { useState, useCallback, useMemo } from 'react'
import { toLocalISO, fromISO } from '@/lib/timezone'

/**
 * V2 schedule form hook — uses browser timezone instead of hardcoded Europe/Madrid.
 * Drop-in replacement for useScheduleForm with timezone-aware date handling.
 */

interface UseScheduleFormV2Return {
  date: string
  time: string
  setDate: (date: string) => void
  setTime: (time: string) => void
  reset: () => void
  isValid: boolean
  toISO: () => string | null
  setFromISO: (isoString: string) => void
}

export const useScheduleFormV2 = (): UseScheduleFormV2Return => {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const reset = useCallback(() => {
    setDate('')
    setTime('')
  }, [])

  const isValid = useMemo(() => {
    return date.length > 0 && time.length > 0
  }, [date, time])

  const toISO = useCallback((): string | null => {
    if (!date || !time) return null
    return toLocalISO(date, time)
  }, [date, time])

  const setFromISO = useCallback((isoString: string) => {
    const { date: localDate, time: localTime } = fromISO(isoString)
    setDate(localDate)
    setTime(localTime)
  }, [])

  return {
    date,
    time,
    setDate,
    setTime,
    reset,
    isValid,
    toISO,
    setFromISO,
  }
}
