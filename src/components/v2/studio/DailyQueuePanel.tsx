'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatStudioDate, formatStudioTime } from '@/lib/studio-datetime'
import type { SerializedCast } from '@/types'

const SCROLL_TO_TODAY_EVENT = 'castor:studio-scroll-to-today'

type DailyQueuePanelProps = {
  casts: SerializedCast[]
  onSelectCast: (castId: string) => void
  onStartCast: () => void
  onCreateOnDate: (date: Date) => void
  onDeleteCast: (castId: string) => void | Promise<void>
  onDuplicateCast: (castId: string) => void | Promise<void>
  onLoadMore?: () => void
  isLoadingMore?: boolean
  hasMore?: boolean
  locale: string
  timeZone: string
}

type DayGroup = {
  key: string
  date: Date
  casts: SerializedCast[]
}

function toDayKey(date: Date, locale: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const month = parts.find((p) => p.type === 'month')?.value ?? '00'
  const day = parts.find((p) => p.type === 'day')?.value ?? '00'

  return `${year}-${month}-${day}`
}

function getReferenceDate(cast: SerializedCast): Date {
  return new Date(cast.publishedAt || cast.scheduledAt)
}

export function DailyQueuePanel({
  casts,
  onSelectCast,
  onStartCast,
  onCreateOnDate,
  onDeleteCast,
  onDuplicateCast,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  locale,
  timeZone,
}: DailyQueuePanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})
  const didInitialScrollToToday = useRef(false)

  const dayGroups = useMemo<DayGroup[]>(() => {
    const sorted = [...casts].sort((a, b) => getReferenceDate(a).getTime() - getReferenceDate(b).getTime())
    const byDay = new Map<string, DayGroup>()

    for (const cast of sorted) {
      const date = getReferenceDate(cast)
      const key = toDayKey(date, locale, timeZone)
      const existing = byDay.get(key)
      if (existing) {
        existing.casts.push(cast)
      } else {
        byDay.set(key, { key, date, casts: [cast] })
      }
    }

    return Array.from(byDay.values())
  }, [casts, locale, timeZone])

  const todayKey = useMemo(() => toDayKey(new Date(), locale, timeZone), [locale, timeZone])

  const scrollToToday = (behavior: ScrollBehavior) => {
    if (dayGroups.length === 0) return
    const targetGroup =
      dayGroups.find((group) => group.key === todayKey) ||
      dayGroups.find((group) => group.key > todayKey) ||
      dayGroups[dayGroups.length - 1]

    if (!targetGroup) return
    const targetEl = dayRefs.current[targetGroup.key]
    if (targetEl) {
      targetEl.scrollIntoView({ behavior, block: 'start' })
    }
  }

  useEffect(() => {
    if (didInitialScrollToToday.current || dayGroups.length === 0) return
    scrollToToday('auto')
    didInitialScrollToToday.current = true
  }, [dayGroups, todayKey])

  useEffect(() => {
    const handleScrollToToday = () => {
      scrollToToday('smooth')
    }
    window.addEventListener(SCROLL_TO_TODAY_EVENT, handleScrollToToday)
    return () => {
      window.removeEventListener(SCROLL_TO_TODAY_EVENT, handleScrollToToday)
    }
  }, [dayGroups, todayKey])

  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <p className="text-sm text-muted-foreground">No casts yet</p>
        <p className="text-xs text-muted-foreground/70">Create your first cast from the composer</p>
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
    <div className="space-y-3">
      {dayGroups.map((group) => {
        const isToday = group.key === todayKey
        const isPastDay = group.key < todayKey

        return (
          <section
            key={group.key}
            ref={(el) => {
              dayRefs.current[group.key] = el
            }}
            className={`rounded-xl border bg-card/30 ${
              isToday ? 'border-[#B89C7A]/70 shadow-[0_0_0_1px_rgba(184,156,122,0.25)]' : 'border-border/60'
            }`}
          >
            <div
              className={`sticky top-0 z-20 border-b backdrop-blur-sm px-3 py-2.5 flex items-center justify-between gap-2 shadow-sm ${
                isToday ? 'bg-[#B89C7A]/20 border-[#B89C7A]/50' : 'bg-muted/80 border-border/60'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-foreground">
                {formatStudioDate(group.date, {
                  locale,
                  timeZone,
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>

              <div className="flex items-center gap-1.5">
                {isToday && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#B89C7A] text-[#1F1A14]">
                    Today
                  </span>
                )}
                <button
                  type="button"
                  disabled={isPastDay}
                  onClick={() => onCreateOnDate(group.date)}
                  className={`h-8 w-8 rounded-md border inline-flex items-center justify-center transition-colors ${
                    isPastDay
                      ? 'border-border bg-muted text-muted-foreground/60 cursor-not-allowed'
                      : 'border-[#B89C7A] bg-[#B89C7A] text-[#1F1A14] hover:bg-[#C7AD8E]'
                  }`}
                  aria-label="Create cast on this day"
                  title={isPastDay ? 'Cannot create casts in past days' : 'Create cast on this day'}
                >
                  <Plus className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            <div className="p-2 space-y-2">
              {group.casts.map((cast) => {
                const isPublished = cast.status === 'published'

                return (
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
                    className="group w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2 py-1">
                        <span className="text-[11px] font-semibold tabular-nums">
                          {formatStudioTime(getReferenceDate(cast), {
                            locale,
                            timeZone,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {cast.status === 'draft' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">Draft</span>
                        )}
                        {cast.status === 'scheduled' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">Scheduled</span>
                        )}
                        {cast.status === 'retrying' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-medium">Retrying</span>
                        )}
                        {cast.status === 'failed' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-medium">Failed</span>
                        )}
                        {isPublished && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-medium">Published</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      {cast.account?.pfpUrl ? (
                        <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-3 text-pretty">{cast.content || 'Empty cast'}</p>
                        {cast.account?.username && (
                          <p className="text-[11px] text-muted-foreground mt-1">@{cast.account.username}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Duplicate as draft"
                          disabled={duplicatingId === cast.id || deletingId === cast.id}
                          onClick={async (e) => {
                            e.stopPropagation()
                            setDuplicatingId(cast.id)
                            try {
                              await Promise.resolve(onDuplicateCast(cast.id))
                            } finally {
                              setDuplicatingId(null)
                            }
                          }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          {duplicatingId === cast.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {!isPublished && (
                          <button
                            type="button"
                            title="Delete cast"
                            disabled={duplicatingId === cast.id || deletingId === cast.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(cast.id)
                            }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {hasMore && onLoadMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          className="w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {isLoadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}

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
              disabled={!deleteTarget || deletingId === deleteTarget}
              onClick={async () => {
                if (deleteTarget) {
                  setDeletingId(deleteTarget)
                  try {
                    await Promise.resolve(onDeleteCast(deleteTarget))
                    setDeleteTarget(null)
                  } finally {
                    setDeletingId(null)
                  }
                }
              }}
            >
              {deleteTarget && deletingId === deleteTarget ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
