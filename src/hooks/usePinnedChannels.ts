'use client'

import { useCallback, useEffect, useState } from 'react'

type PinnedChannel = {
  id: string
  name: string
  image_url?: string
}

export function usePinnedChannels() {
  const [pinnedChannels, setPinnedChannels] = useState<PinnedChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPinned = useCallback(async () => {
    try {
      const res = await fetch('/api/channels/pinned')
      if (!res.ok) {
        setPinnedChannels([])
        return
      }
      const data = await res.json()
      setPinnedChannels(Array.isArray(data?.pinned) ? data.pinned : [])
    } catch (error) {
      console.error('Error fetching pinned channels:', error)
      setPinnedChannels([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reorder = async (newOrder: PinnedChannel[]) => {
    // Optimistic update
    setPinnedChannels(newOrder)

    try {
      const res = await fetch('/api/channels/pinned', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: newOrder.map((c, i) => ({ id: c.id, order: i }))
        })
      })

      if (!res.ok) throw new Error('Failed to persist order')
    } catch (error) {
      console.error('Error persisting order:', error)
      // Rollback on error
      fetchPinned()
    }
  }

  useEffect(() => {
    fetchPinned()
  }, [fetchPinned])

  return { pinnedChannels, isLoading, refetch: fetchPinned, reorder }
}
