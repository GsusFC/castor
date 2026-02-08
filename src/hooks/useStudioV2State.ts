import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { SerializedCast, SerializedTemplate } from '@/types'

const ACCOUNT_FILTER_STORAGE_KEY = 'castor_v2_studio_account_filter'
const QUEUE_STATUSES = ['scheduled', 'draft', 'retrying', 'failed']
const ACTIVITY_STATUSES = ['published']
const PAGE_SIZE = 20

function dedupeCasts(casts: SerializedCast[]) {
  const seen = new Set<string>()
  const deduped: SerializedCast[] = []

  for (const cast of casts) {
    if (seen.has(cast.id)) continue
    seen.add(cast.id)
    deduped.push(cast)
  }

  return deduped
}

function updateCastDate(cast: SerializedCast, castId: string, newDate: Date): SerializedCast {
  if (cast.id !== castId) return cast
  return {
    ...cast,
    scheduledAt: newDate.toISOString(),
  }
}

type UseStudioV2StateArgs = {
  casts: SerializedCast[]
  templates: SerializedTemplate[]
  approvedAccountIds: string[]
}

export function useStudioV2State({
  casts,
  templates,
  approvedAccountIds,
}: UseStudioV2StateArgs) {
  const didHydrateAccountFilter = useRef(false)

  const [studioCasts, setStudioCasts] = useState<SerializedCast[]>(casts)
  const [studioTemplates, setStudioTemplates] = useState<SerializedTemplate[]>(templates)
  const [queueExtraCasts, setQueueExtraCasts] = useState<SerializedCast[]>([])
  const [activityExtraCasts, setActivityExtraCasts] = useState<SerializedCast[]>([])
  const [isLoadingMoreQueue, setIsLoadingMoreQueue] = useState(false)
  const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false)
  const [queueHasMore, setQueueHasMore] = useState(true)
  const [activityHasMore, setActivityHasMore] = useState(true)
  const [accountFilter, setAccountFilter] = useState<string>('all')

  useEffect(() => {
    setStudioCasts(casts)
  }, [casts])

  useEffect(() => {
    setStudioTemplates(templates)
  }, [templates])

  useEffect(() => {
    if (didHydrateAccountFilter.current) return

    const stored = typeof window !== 'undefined'
      ? window.localStorage.getItem(ACCOUNT_FILTER_STORAGE_KEY)
      : null

    if (stored && (stored === 'all' || approvedAccountIds.includes(stored))) {
      setAccountFilter(stored)
    }

    didHydrateAccountFilter.current = true
  }, [approvedAccountIds])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCOUNT_FILTER_STORAGE_KEY, accountFilter)
    }
  }, [accountFilter])

  useEffect(() => {
    setQueueExtraCasts([])
    setActivityExtraCasts([])
    setQueueHasMore(true)
    setActivityHasMore(true)
  }, [accountFilter])

  const getIsInFilter = useCallback((cast: SerializedCast) => {
    if (accountFilter === 'all') return true
    return cast.accountId === accountFilter
  }, [accountFilter])

  const allQueueSource = useMemo(
    () => dedupeCasts([...studioCasts, ...queueExtraCasts]),
    [studioCasts, queueExtraCasts]
  )
  const allActivitySource = useMemo(
    () => dedupeCasts([...studioCasts, ...activityExtraCasts]),
    [studioCasts, activityExtraCasts]
  )
  const allKnownCasts = useMemo(
    () => dedupeCasts([...studioCasts, ...queueExtraCasts, ...activityExtraCasts]),
    [studioCasts, queueExtraCasts, activityExtraCasts]
  )

  const filteredCasts = useMemo(() => studioCasts.filter(getIsInFilter), [studioCasts, getIsInFilter])

  const upcomingCasts = useMemo(() => {
    return allQueueSource
      .filter(c => QUEUE_STATUSES.includes(c.status) && getIsInFilter(c))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }, [allQueueSource, getIsInFilter])

  const recentActivity = useMemo(() => {
    return allActivitySource
      .filter(c => ACTIVITY_STATUSES.includes(c.status) && getIsInFilter(c))
      .sort((a, b) => new Date(b.publishedAt || b.scheduledAt).getTime() - new Date(a.publishedAt || a.scheduledAt).getTime())
  }, [allActivitySource, getIsInFilter])

  const fetchMoreCasts = useCallback(async ({
    statuses,
    orderBy,
    sort,
    offset,
  }: {
    statuses: string[]
    orderBy: 'scheduledAt' | 'publishedAt'
    sort: 'asc' | 'desc'
    offset: number
  }) => {
    const params = new URLSearchParams({
      statuses: statuses.join(','),
      orderBy,
      sort,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })

    if (accountFilter !== 'all') {
      params.set('accountId', accountFilter)
    }

    const response = await fetch(`/api/casts?${params.toString()}`)
    if (!response.ok) {
      throw new Error('Could not load more casts')
    }

    return response.json() as Promise<{ casts: SerializedCast[]; hasMore?: boolean }>
  }, [accountFilter])

  const loadMoreQueue = useCallback(async () => {
    if (isLoadingMoreQueue || !queueHasMore) return

    setIsLoadingMoreQueue(true)
    try {
      const { casts: moreCasts, hasMore } = await fetchMoreCasts({
        statuses: QUEUE_STATUSES,
        orderBy: 'scheduledAt',
        sort: 'asc',
        offset: upcomingCasts.length,
      })

      setQueueExtraCasts((prev) => dedupeCasts([...prev, ...moreCasts]))
      setQueueHasMore(Boolean(hasMore))
    } catch {
      toast.error('Could not load more queued casts')
    } finally {
      setIsLoadingMoreQueue(false)
    }
  }, [fetchMoreCasts, isLoadingMoreQueue, queueHasMore, upcomingCasts.length])

  const loadMoreActivity = useCallback(async () => {
    if (isLoadingMoreActivity || !activityHasMore) return

    setIsLoadingMoreActivity(true)
    try {
      const { casts: moreCasts, hasMore } = await fetchMoreCasts({
        statuses: ACTIVITY_STATUSES,
        orderBy: 'publishedAt',
        sort: 'desc',
        offset: recentActivity.length,
      })

      setActivityExtraCasts((prev) => dedupeCasts([...prev, ...moreCasts]))
      setActivityHasMore(Boolean(hasMore))
    } catch {
      toast.error('Could not load more activity')
    } finally {
      setIsLoadingMoreActivity(false)
    }
  }, [activityHasMore, fetchMoreCasts, isLoadingMoreActivity, recentActivity.length])

  const handleMoveCast = useCallback(async (castId: string, newDate: Date) => {
    const response = await fetch(`/api/casts/${castId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
    })

    if (!response.ok) {
      throw new Error('Failed to move cast')
    }

    setStudioCasts((prev) => prev.map((cast) => updateCastDate(cast, castId, newDate)))
    setQueueExtraCasts((prev) => prev.map((cast) => updateCastDate(cast, castId, newDate)))
    setActivityExtraCasts((prev) => prev.map((cast) => updateCastDate(cast, castId, newDate)))
  }, [])

  const removeCastFromAll = useCallback((castId: string) => {
    setStudioCasts(prev => prev.filter(c => c.id !== castId))
    setQueueExtraCasts(prev => prev.filter(c => c.id !== castId))
    setActivityExtraCasts(prev => prev.filter(c => c.id !== castId))
  }, [])

  const handleDeleteCast = useCallback(async (castId: string) => {
    const prevStudio = studioCasts
    const prevQueue = queueExtraCasts
    const prevActivity = activityExtraCasts

    removeCastFromAll(castId)

    try {
      const res = await fetch(`/api/casts/${castId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Cast deleted')
    } catch {
      setStudioCasts(prevStudio)
      setQueueExtraCasts(prevQueue)
      setActivityExtraCasts(prevActivity)
      toast.error('Could not delete cast')
    }
  }, [studioCasts, queueExtraCasts, activityExtraCasts, removeCastFromAll])

  const handleDuplicateCast = useCallback(async (castId: string) => {
    try {
      const res = await fetch(`/api/casts/${castId}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to duplicate')
      const { data } = await res.json() as { data: { castId: string; status: string } }

      const original = [...studioCasts, ...queueExtraCasts, ...activityExtraCasts].find(c => c.id === castId)
      if (original && data?.castId) {
        const duplicated: SerializedCast = {
          ...original,
          id: data.castId,
          status: 'draft',
          scheduledAt: new Date().toISOString(),
          publishedAt: null,
          castHash: null,
        }
        setStudioCasts(prev => [...prev, duplicated])
      }

      toast.success('Cast duplicated as draft')
    } catch {
      toast.error('Could not duplicate cast')
    }
  }, [studioCasts, queueExtraCasts, activityExtraCasts])

  const handleCastCreated = useCallback((newCast: SerializedCast) => {
    setStudioCasts(prev => dedupeCasts([...prev, newCast]))
  }, [])

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    const prev = studioTemplates
    setStudioTemplates(t => t.filter(x => x.id !== templateId))

    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Template deleted')
    } catch {
      setStudioTemplates(prev)
      toast.error('Could not delete template')
    }
  }, [studioTemplates])

  return {
    accountFilter,
    setAccountFilter,
    filteredCasts,
    upcomingCasts,
    recentActivity,
    studioTemplates,
    loadMoreQueue,
    loadMoreActivity,
    isLoadingMoreQueue,
    isLoadingMoreActivity,
    queueHasMore,
    activityHasMore,
    allKnownCasts,
    handleMoveCast,
    handleDeleteCast,
    handleDuplicateCast,
    handleCastCreated,
    handleDeleteTemplate,
  }
}
