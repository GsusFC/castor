'use client'

import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { AppHeader } from '@/components/v2/AppHeader'
import { StudioLayout } from '@/components/v2/StudioLayout'
import { ComposerPanel, ComposerPanelRef } from '@/components/v2/ComposerPanel'
import { CalendarView } from '@/components/calendar/CalendarView'
import { SelectedAccountV2Provider } from '@/context/SelectedAccountV2Context'
import { Clock, FileText, Copy, Trash2, Pen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatStudioDate, formatStudioTime, getStudioLocale, getStudioTimeZone } from '@/lib/studio-datetime'
import type {
  SerializedAccount,
  SerializedCast,
  SerializedTemplate,
  SessionUser,
} from '@/types'

interface StudioV2ClientProps {
  user: SessionUser
  accounts: SerializedAccount[]
  casts: SerializedCast[]
  templates: SerializedTemplate[]
}

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

export function StudioV2Client({ user, accounts, casts, templates }: StudioV2ClientProps) {
  const composerRef = useRef<ComposerPanelRef>(null)
  const didHydrateAccountFilter = useRef(false)
  const approvedAccounts = useMemo(
    () => accounts.filter(a => a.signerStatus === 'approved'),
    [accounts]
  )

  const [studioCasts, setStudioCasts] = useState<SerializedCast[]>(casts)
  const [studioTemplates, setStudioTemplates] = useState<SerializedTemplate[]>(templates)
  const [queueExtraCasts, setQueueExtraCasts] = useState<SerializedCast[]>([])
  const [activityExtraCasts, setActivityExtraCasts] = useState<SerializedCast[]>([])
  const [isLoadingMoreQueue, setIsLoadingMoreQueue] = useState(false)
  const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false)
  const [queueHasMore, setQueueHasMore] = useState(true)
  const [activityHasMore, setActivityHasMore] = useState(true)
  const [accountFilter, setAccountFilter] = useState<string>('all')

  const locale = useMemo(() => getStudioLocale(), [])
  const timeZone = useMemo(() => getStudioTimeZone(), [])

  useEffect(() => {
    setStudioCasts(casts)
  }, [casts])

  useEffect(() => {
    if (didHydrateAccountFilter.current) return

    const stored = typeof window !== 'undefined'
      ? window.localStorage.getItem(ACCOUNT_FILTER_STORAGE_KEY)
      : null

    if (stored && (stored === 'all' || approvedAccounts.some(account => account.id === stored))) {
      setAccountFilter(stored)
    }

    didHydrateAccountFilter.current = true
  }, [approvedAccounts])

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

  const defaultAccountId = useMemo(() => {
    const userAccount = approvedAccounts.find(a => a.fid === user.fid)
    return userAccount?.id || approvedAccounts[0]?.id || null
  }, [approvedAccounts, user.fid])

  const getIsInFilter = useCallback((cast: SerializedCast) => {
    if (accountFilter === 'all') return true
    return cast.accountId === accountFilter
  }, [accountFilter])

  const allQueueSource = useMemo(() => dedupeCasts([...studioCasts, ...queueExtraCasts]), [studioCasts, queueExtraCasts])
  const allActivitySource = useMemo(() => dedupeCasts([...studioCasts, ...activityExtraCasts]), [studioCasts, activityExtraCasts])

  const filteredCasts = useMemo(() => {
    return studioCasts.filter(getIsInFilter)
  }, [studioCasts, getIsInFilter])

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

  const handleMoveCast = async (castId: string, newDate: Date) => {
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
  }

  const handleSelectDate = useCallback((date: Date) => {
    composerRef.current?.setScheduleDate(date)
  }, [])

  const handleSelectCast = useCallback((castId: string) => {
    const cast = [...studioCasts, ...queueExtraCasts, ...activityExtraCasts].find(c => c.id === castId)
    if (cast) {
      composerRef.current?.loadCast(cast)
    }
  }, [activityExtraCasts, queueExtraCasts, studioCasts])

  const handleStartCast = useCallback(() => {
    composerRef.current?.startNewCast()
  }, [])

  const removeCastFromAll = useCallback((castId: string) => {
    setStudioCasts(prev => prev.filter(c => c.id !== castId))
    setQueueExtraCasts(prev => prev.filter(c => c.id !== castId))
    setActivityExtraCasts(prev => prev.filter(c => c.id !== castId))
  }, [])

  const handleDeleteCast = useCallback(async (castId: string) => {
    // Snapshot for rollback
    const prevStudio = studioCasts
    const prevQueue = queueExtraCasts
    const prevActivity = activityExtraCasts

    // Optimistic remove
    removeCastFromAll(castId)

    try {
      const res = await fetch(`/api/casts/${castId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Cast deleted')
    } catch {
      // Rollback
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

      // Find original cast to copy its display data
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

  const handleLoadTemplateFromPanel = useCallback((template: SerializedTemplate) => {
    composerRef.current?.loadCast({
      id: '',
      accountId: template.accountId,
      content: template.content,
      status: 'draft',
      scheduledAt: new Date().toISOString(),
      publishedAt: null,
      castHash: null,
      channelId: template.channelId,
      errorMessage: null,
      retryCount: 0,
      media: [],
      account: null,
      createdBy: null,
    })
  }, [])

  return (
    <SelectedAccountV2Provider defaultAccountId={defaultAccountId}>
      <AppHeader
        user={{
          username: user.username,
          displayName: user.displayName,
          pfpUrl: user.pfpUrl,
        }}
        accounts={approvedAccounts.map(a => ({
          id: a.id,
          username: a.username,
          pfpUrl: a.pfpUrl,
        }))}
      />

      <StudioLayout
        composerPanel={
          <ComposerPanel
            ref={composerRef}
            accounts={approvedAccounts}
            userFid={user.fid}
            defaultAccountId={defaultAccountId}
            templates={templates}
            onCastCreated={handleCastCreated}
          />
        }
        rightPanelControls={
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            Account
            <select
              aria-label="Filter studio panels by account"
              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="all">All accounts</option>
              {approvedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.username}
                </option>
              ))}
            </select>
          </label>
        }
        calendarPanel={
          <CalendarView
            casts={filteredCasts.map(c => ({
              id: c.id,
              content: c.content || '',
              status: c.status,
              scheduledAt: new Date(c.scheduledAt),
              account: c.account ? { username: c.account.username, pfpUrl: c.account.pfpUrl } : null,
            }))}
            onMoveCast={handleMoveCast}
            onSelectDate={handleSelectDate}
            onSelectCast={handleSelectCast}
            locale={locale}
            timeZone={timeZone}
            weekStartsOn={1}
          />
        }
        queuePanel={
          <QueuePanel
            casts={upcomingCasts}
            onSelectCast={handleSelectCast}
            onStartCast={handleStartCast}
            onDeleteCast={handleDeleteCast}
            onDuplicateCast={handleDuplicateCast}
            onLoadMore={loadMoreQueue}
            isLoadingMore={isLoadingMoreQueue}
            hasMore={queueHasMore}
            locale={locale}
            timeZone={timeZone}
          />
        }
        activityPanel={
          <ActivityPanel
            casts={recentActivity}
            onSelectCast={handleSelectCast}
            onStartCast={handleStartCast}
            onDuplicateCast={handleDuplicateCast}
            onLoadMore={loadMoreActivity}
            isLoadingMore={isLoadingMoreActivity}
            hasMore={activityHasMore}
            locale={locale}
            timeZone={timeZone}
          />
        }
        templatesPanel={
          <TemplatesPanel
            templates={studioTemplates}
            onLoadTemplate={handleLoadTemplateFromPanel}
            onDeleteTemplate={handleDeleteTemplate}
          />
        }
      />
    </SelectedAccountV2Provider>
  )
}

export function QueuePanel({
  casts,
  onSelectCast,
  onStartCast,
  onDeleteCast,
  onDuplicateCast,
  onLoadMore,
  isLoadingMore,
  hasMore,
  locale,
  timeZone,
}: {
  casts: SerializedCast[]
  onSelectCast: (castId: string) => void
  onStartCast: () => void
  onDeleteCast: (castId: string) => void
  onDuplicateCast: (castId: string) => void
  onLoadMore: () => void
  isLoadingMore: boolean
  hasMore: boolean
  locale: string
  timeZone: string
}) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const draftCount = casts.filter(c => c.status === 'draft').length
  const scheduledCount = casts.filter(c => c.status === 'scheduled').length

  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <Clock className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No scheduled casts</p>
        <p className="text-xs text-muted-foreground/70">Create your next cast from the composer panel</p>
        <button
          type="button"
          onClick={onStartCast}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Start new cast
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Counts */}
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        {scheduledCount > 0 && <span>{scheduledCount} scheduled</span>}
        {scheduledCount > 0 && draftCount > 0 && <span>&middot;</span>}
        {draftCount > 0 && <span>{draftCount} drafts</span>}
      </div>

      {casts.map(cast => (
        <div
          key={cast.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectCast(cast.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelectCast(cast.id)
            }
          }}
          className="group w-full text-left flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
        >
          {cast.account?.pfpUrl ? (
            <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2 text-pretty">{cast.content || 'Empty cast'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatStudioDate(cast.scheduledAt, {
                  locale,
                  timeZone,
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatStudioTime(cast.scheduledAt, {
                  locale,
                  timeZone,
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {cast.status === 'draft' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                  Draft
                </span>
              )}
              {cast.status === 'retrying' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-medium">
                  Retrying
                </span>
              )}
              {cast.status === 'failed' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-medium">
                  Failed
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title="Duplicate as draft"
              onClick={(e) => { e.stopPropagation(); onDuplicateCast(cast.id) }}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Delete cast"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(cast.id) }}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          className="w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {isLoadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete cast</DialogTitle>
            <DialogDescription>
              This will permanently delete the cast. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteCast(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ActivityPanel({
  casts,
  onSelectCast,
  onStartCast,
  onDuplicateCast,
  onLoadMore,
  isLoadingMore,
  hasMore,
  locale,
  timeZone,
}: {
  casts: SerializedCast[]
  onSelectCast: (castId: string) => void
  onStartCast: () => void
  onDuplicateCast: (castId: string) => void
  onLoadMore: () => void
  isLoadingMore: boolean
  hasMore: boolean
  locale: string
  timeZone: string
}) {
  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No published casts yet</p>
        <p className="text-xs text-muted-foreground/70">Publish from the composer to build activity history</p>
        <button
          type="button"
          onClick={onStartCast}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Create first cast
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {casts.map(cast => (
        <div
          key={cast.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectCast(cast.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelectCast(cast.id)
            }
          }}
          className="group w-full text-left flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
        >
          {cast.account?.pfpUrl ? (
            <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2 text-pretty">{cast.content || 'Empty cast'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs tabular-nums text-muted-foreground">
                Published {formatStudioDate(cast.publishedAt || cast.scheduledAt, {
                  locale,
                  timeZone,
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {cast.castHash && (
                <a
                  href={`https://warpcast.com/~/conversations/${cast.castHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on Warpcast
                </a>
              )}
            </div>
          </div>

          {/* Duplicate button */}
          <button
            type="button"
            title="Duplicate as draft"
            onClick={(e) => { e.stopPropagation(); onDuplicateCast(cast.id) }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          className="w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {isLoadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function TemplatesPanel({
  templates,
  onLoadTemplate,
  onDeleteTemplate,
}: {
  templates: SerializedTemplate[]
  onLoadTemplate: (template: SerializedTemplate) => void
  onDeleteTemplate: (id: string) => void
}) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No templates yet</p>
        <p className="text-xs text-muted-foreground/70">Save templates from the composer to reuse content</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{templates.length} templates</p>

      {templates.map(template => (
        <div
          key={template.id}
          className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{template.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 text-pretty">
              {template.content || 'Empty template'}
            </p>
            {template.channelId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium mt-1 inline-block">
                /{template.channelId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title="Load in composer"
              onClick={() => onLoadTemplate(template)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Pen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Delete template"
              onClick={() => setDeleteTarget(template.id)}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              This will permanently delete the template. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteTemplate(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
