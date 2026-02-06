'use client'

import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { CastItem } from '@/components/compose/types'

const createEmptyCast = (): CastItem => ({
  id: nanoid(),
  content: '',
  media: [],
  links: [],
})

interface UseCastThreadReturn {
  casts: CastItem[]
  isThread: boolean
  updateCast: (index: number, cast: CastItem) => void
  addCast: () => void
  removeCast: (index: number) => void
  reset: () => void
  setCasts: (casts: CastItem[]) => void
}

export const useCastThread = (): UseCastThreadReturn => {
  const [casts, setCasts] = useState<CastItem[]>([createEmptyCast()])

  const updateCast = useCallback((index: number, updatedCast: CastItem) => {
    setCasts(prev => prev.map((c, i) => (i === index ? updatedCast : c)))
  }, [])

  const addCast = useCallback(() => {
    setCasts(prev => [...prev, createEmptyCast()])
  }, [])

  const removeCast = useCallback((index: number) => {
    setCasts(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const reset = useCallback(() => {
    setCasts([createEmptyCast()])
  }, [])

  return {
    casts,
    isThread: casts.length > 1,
    updateCast,
    addCast,
    removeCast,
    reset,
    setCasts,
  }
}
