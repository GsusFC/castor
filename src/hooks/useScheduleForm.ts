'use client'

import { useState, useCallback, useMemo } from 'react'
import { toMadridISO } from '@/lib/time'

interface UseScheduleFormReturn {
  date: string
  time: string
  setDate: (date: string) => void
  setTime: (time: string) => void
  reset: () => void
  isValid: boolean
  toISO: () => string | null
  setFromISO: (isoString: string) => void
}

export const useScheduleForm = (): UseScheduleFormReturn => {
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
    return toMadridISO(date, time)
  }, [date, time])

  const setFromISO = useCallback((isoString: string) => {
    const dateObj = new Date(isoString)

    const madridDate = dateObj.toLocaleDateString('en-CA', {
      timeZone: 'Europe/Madrid',
    })

    const madridTime = dateObj.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Madrid',
    })

    setDate(madridDate)
    setTime(madridTime)
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
