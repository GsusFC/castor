import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export type FeedTab = 'home' | 'following' | 'trending' | 'channel'

type FeedNavigation = {
  activeTab: FeedTab
  selectedCast: string | null
  selectedUser: string | null
  selectedChannelId: string | null
  setTab: (tab: FeedTab) => void
  openCast: (castHash: string) => void
  openUser: (username: string) => void
  openChannel: (channelId: string) => void
  closeOverlay: () => void
  clearChannel: () => void
}

export function useFeedNavigation(): FeedNavigation {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

  const selectedCast = searchParams.get('cast')?.trim() || null
  const selectedUser = searchParams.get('user')?.trim() || null
  const selectedChannelId = searchParams.get('channel')?.trim() || null

  const [lastNonChannelTab, setLastNonChannelTab] = useState<FeedTab>('home')
  const activeTab = selectedChannelId ? 'channel' : lastNonChannelTab

  const updateParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParamsString)
      updater(next)
      const qs = next.toString()
      router.push(qs ? `/?${qs}` : '/')
    },
    [router, searchParamsString]
  )

  const setTab = useCallback(
    (tab: FeedTab) => {
      if (tab !== 'channel') {
        setLastNonChannelTab(tab)
      }
      if (selectedChannelId) {
        updateParams((next) => {
          next.delete('channel')
        })
      }
    },
    [selectedChannelId, updateParams]
  )

  const openCast = useCallback(
    (castHash: string) => {
      if (!castHash) return
      updateParams((next) => {
        next.set('cast', castHash)
        next.delete('user')
      })
    },
    [updateParams]
  )

  const openUser = useCallback(
    (username: string) => {
      if (!username) return
      updateParams((next) => {
        next.set('user', username)
        next.delete('cast')
      })
    },
    [updateParams]
  )

  const openChannel = useCallback(
    (channelId: string) => {
      if (!channelId) return
      updateParams((next) => {
        next.set('channel', channelId)
        next.delete('cast')
        next.delete('user')
      })
    },
    [updateParams]
  )

  const closeOverlay = useCallback(() => {
    updateParams((next) => {
      next.delete('cast')
      next.delete('user')
    })
  }, [updateParams])

  const clearChannel = useCallback(() => {
    updateParams((next) => {
      next.delete('channel')
    })
  }, [updateParams])

  return {
    activeTab,
    selectedCast,
    selectedUser,
    selectedChannelId,
    setTab,
    openCast,
    openUser,
    openChannel,
    closeOverlay,
    clearChannel,
  }
}
