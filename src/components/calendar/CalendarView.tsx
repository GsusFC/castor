'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { formatStudioDate, formatStudioTime, getStudioLocale, getStudioTimeZone } from '@/lib/studio-datetime'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useMediaQueryBelow } from '@/hooks/useMediaQuery'

interface Cast {
  id: string
  content: string
  scheduledAt: Date
  status: string
  account: {
    username: string
    pfpUrl: string | null
  } | null
}

interface CalendarViewProps {
  casts: Cast[]
  onMoveCast: (castId: string, newDate: Date) => Promise<void>
  onSelectDate?: (date: Date) => void
  onSelectCast?: (castId: string) => void
  onDuplicateCast?: (castId: string) => void
  onDeleteCast?: (castId: string) => void
  locale?: string
  timeZone?: string
  weekStartsOn?: 0 | 1
}

const WEEKDAY_LABELS = {
  0: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  1: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
} as const

const DEFAULT_WEEK_STARTS_ON: 0 | 1 = 1
function toDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDayKey(key: string): { year: number; month: number; day: number } | null {
  const [yearRaw, monthRaw, dayRaw] = key.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return { year, month, day }
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
  draft: 'Draft',
  retrying: 'Retrying',
}

function getStatusDotClass(status: string) {
  if (status === 'published') return 'bg-emerald-400'
  if (status === 'scheduled') return 'bg-blue-400'
  if (status === 'draft') return 'bg-amber-400'
  if (status === 'retrying') return 'bg-orange-400'
  if (status === 'failed') return 'bg-red-400'
  return 'bg-muted-foreground'
}

function getStatusCardTone(status: string) {
  if (status === 'published') return 'border-emerald-400/75 bg-emerald-500/10'
  if (status === 'scheduled') return 'border-blue-400/75 bg-blue-500/10'
  if (status === 'draft') return 'border-amber-400/65 bg-amber-500/8'
  if (status === 'retrying') return 'border-orange-400/65 bg-orange-500/8'
  if (status === 'failed') return 'border-red-400/70 bg-red-500/8'
  return 'border-border bg-card'
}

export function CalendarView({
  casts,
  onMoveCast,
  onSelectDate,
  onSelectCast,
  onDuplicateCast,
  onDeleteCast,
  locale,
  timeZone,
  weekStartsOn = DEFAULT_WEEK_STARTS_ON,
}: CalendarViewProps) {
  const resolvedLocale = locale || getStudioLocale()
  const resolvedTimeZone = timeZone || getStudioTimeZone()
  const isMobile = useMediaQueryBelow('sm')

  const [currentDate, setCurrentDate] = useState(new Date())
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date())
  const [activeCast, setActiveCast] = useState<Cast | null>(null)
  const [optimisticCasts, setOptimisticCasts] = useState<Cast[]>(casts)
  const [deleteTarget, setDeleteTarget] = useState<Cast | null>(null)
  const [detailDayKey, setDetailDayKey] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticCasts(casts)
  }, [casts])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: Date[] = []

    const rawStartDayOfWeek = firstDay.getDay()
    const normalizedStart = weekStartsOn === 1 ? (rawStartDayOfWeek + 6) % 7 : rawStartDayOfWeek

    for (let i = normalizedStart - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i))
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }, [currentDate, weekStartsOn])

  const castsByDay = useMemo(() => {
    const map = new Map<string, Cast[]>()

    optimisticCasts.forEach((cast) => {
      const date = new Date(cast.scheduledAt)
      const key = toDayKey(date)

      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(cast)
    })

    return map
  }, [optimisticCasts])

  const mobileWeekDays = useMemo(() => {
    const base = new Date(mobileSelectedDate)
    const dayOfWeek = base.getDay()
    const normalized = weekStartsOn === 1 ? (dayOfWeek + 6) % 7 : dayOfWeek
    const start = new Date(base)
    start.setDate(base.getDate() - normalized)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [mobileSelectedDate, weekStartsOn])

  const mobileAgendaCasts = useMemo(() => {
    const key = toDayKey(mobileSelectedDate)
    return [...(castsByDay.get(key) || [])].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
  }, [castsByDay, mobileSelectedDate])

  const detailDayDate = useMemo(() => {
    if (!detailDayKey) return null
    const parsed = fromDayKey(detailDayKey)
    if (!parsed) return null
    return new Date(parsed.year, parsed.month - 1, parsed.day)
  }, [detailDayKey])

  const detailDayCasts = useMemo(() => {
    if (!detailDayKey) return []
    const dayCasts = castsByDay.get(detailDayKey) || []
    return [...dayCasts].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
  }, [castsByDay, detailDayKey])

  const handleDragStart = (event: DragStartEvent) => {
    const cast = optimisticCasts.find((c) => c.id === event.active.id)
    if (cast) {
      setActiveCast(cast)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCast(null)

    const { active, over } = event

    if (!over) return

    const castId = active.id as string
    const targetDateStr = over.id as string
    const target = fromDayKey(targetDateStr)
    if (!target) return

    const cast = optimisticCasts.find((c) => c.id === castId)
    if (!cast || cast.status !== 'scheduled') return

    const originalDate = new Date(cast.scheduledAt)
    const newDate = new Date(
      target.year,
      target.month - 1,
      target.day,
      originalDate.getHours(),
      originalDate.getMinutes()
    )

    const previousCasts = optimisticCasts
    setOptimisticCasts((prev) =>
      prev.map((item) =>
        item.id === castId
          ? { ...item, scheduledAt: newDate }
          : item
      )
    )

    try {
      await onMoveCast(castId, newDate)
      toast.success('Cast rescheduled')
    } catch {
      setOptimisticCasts(previousCasts)
      toast.error('Could not reschedule cast. Changes were reverted.')
    }
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const today = new Date()
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth()
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  const prevWeek = () => {
    const next = new Date(mobileSelectedDate)
    next.setDate(next.getDate() - 7)
    setMobileSelectedDate(next)
    setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1))
  }

  const nextWeek = () => {
    const next = new Date(mobileSelectedDate)
    next.setDate(next.getDate() + 7)
    setMobileSelectedDate(next)
    setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1))
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-card rounded-xl border font-sans text-[12px]">
        <div className="hidden md:flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-[12px] uppercase tracking-wide">
            {formatStudioDate(currentDate, {
              locale: resolvedLocale,
              timeZone: resolvedTimeZone,
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Go to previous month"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-[12px] font-medium hover:bg-muted rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Go to next month"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile: Week strip + Agenda (replaces dense month grid) */}
        <div className="md:hidden border-b px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium">
              {formatStudioDate(mobileWeekDays[0], { locale: resolvedLocale, timeZone: resolvedTimeZone, month: 'short', day: 'numeric' })}
              {' - '}
              {formatStudioDate(mobileWeekDays[6], { locale: resolvedLocale, timeZone: resolvedTimeZone, month: 'short', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevWeek}
                aria-label="Previous week"
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  setMobileSelectedDate(now)
                  setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1))
                }}
                className="px-2 py-1 text-[12px] font-medium hover:bg-muted rounded-md transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextWeek}
                aria-label="Next week"
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {mobileWeekDays.map((date) => {
              const selected = toDayKey(date) === toDayKey(mobileSelectedDate)
              const dayCount = (castsByDay.get(toDayKey(date)) || []).length
              return (
                <button
                  key={toDayKey(date)}
                  type="button"
                  onClick={() => {
                    setMobileSelectedDate(date)
                    onSelectDate?.(date)
                  }}
                  className={`rounded-md border px-1 py-1 text-center transition-colors ${
                    selected ? 'bg-primary/10 border-primary/40 text-primary' : 'hover:bg-muted border-border'
                  }`}
                >
                  <div className="text-[12px] text-muted-foreground">
                    {formatStudioDate(date, { locale: resolvedLocale, timeZone: resolvedTimeZone, weekday: 'short' })}
                  </div>
                  <div className="text-[12px] font-semibold tabular-nums">{date.getDate()}</div>
                  <div className="h-3 flex items-center justify-center">
                    {dayCount > 0 ? <span className="size-1.5 rounded-full bg-muted-foreground/70" /> : null}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="pt-1 space-y-1.5">
            {mobileAgendaCasts.length === 0 ? (
              <div className="text-[12px] text-muted-foreground px-1 py-2">No casts for this day</div>
            ) : (
              mobileAgendaCasts.map((cast) => (
                <div
                  key={`agenda-${cast.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectCast?.(cast.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectCast?.(cast.id)
                    }
                  }}
                  className="flex items-start gap-2 rounded-md border p-2 bg-card hover:bg-muted/40"
                >
                  <div className="text-[12px] tabular-nums text-muted-foreground min-w-[52px]">
                    {formatStudioTime(cast.scheduledAt, {
                      locale: resolvedLocale,
                      timeZone: resolvedTimeZone,
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] line-clamp-2">{cast.content || 'Empty cast'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden md:grid grid-cols-7 border-b">
          {WEEKDAY_LABELS[weekStartsOn].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-[12px] font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="hidden md:grid grid-cols-7">
          {calendarDays.map((date) => {
            const dateKey = toDayKey(date)
            const dayCasts = castsByDay.get(dateKey) || []

            return (
              <CalendarDay
                key={dateKey}
                date={date}
                dateKey={dateKey}
                casts={dayCasts}
                isCurrentMonth={isCurrentMonth(date)}
                isToday={isToday(date)}
                onSelectDate={onSelectDate}
                onSelectCast={onSelectCast}
                onDuplicateCast={onDuplicateCast}
                onDeleteCast={onDeleteCast}
                onRequestDelete={setDeleteTarget}
                onOpenDayDetail={setDetailDayKey}
                locale={resolvedLocale}
                timeZone={resolvedTimeZone}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activeCast && <CastCard cast={activeCast} locale={resolvedLocale} timeZone={resolvedTimeZone} isDragging />}
      </DragOverlay>

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
                if (deleteTarget && onDeleteCast) {
                  onDeleteCast(deleteTarget.id)
                }
                setDeleteTarget(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detailDayKey} onOpenChange={(open) => !open && setDetailDayKey(null)}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'p-0 overflow-hidden transition-all duration-300 ease-out border-none',
            isMobile
              ? 'w-full h-[70dvh] rounded-t-xl bg-background text-foreground'
              : 'w-full sm:w-[22vw] sm:min-w-[360px] sm:max-w-[520px] sm:top-4 sm:bottom-4 sm:right-4 sm:h-[calc(100dvh-32px)] sm:rounded-xl sm:bg-background sm:shadow-[0_10px_40px_rgba(0,0,0,0.15)] sm:border sm:border-border/30 text-foreground'
          )}
        >
          <SheetHeader className="px-6 py-4 border-b border-border/10">
            <SheetTitle className="text-lg font-bold tracking-tight text-foreground/90 text-balance">
              {detailDayDate
                ? formatStudioDate(detailDayDate, {
                    locale: resolvedLocale,
                    timeZone: resolvedTimeZone,
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Day details'}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground">
              Scheduled casts
            </SheetDescription>
          </SheetHeader>

          <div className={cn(
            'space-y-2 overflow-y-auto px-5 py-4',
            isMobile ? 'h-[calc(70dvh-5.5rem)]' : 'h-[calc(100dvh-5.5rem)]'
          )}>
            {detailDayCasts.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">No casts for this day.</div>
            ) : (
              detailDayCasts.map((cast) => {
                const canDelete = ['draft', 'scheduled', 'retrying', 'failed'].includes(cast.status)
                return (
                  <div
                    key={`detail-${cast.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectCast?.(cast.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectCast?.(cast.id)
                      }
                    }}
                    className="rounded-md border p-3 hover:bg-muted/40 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] text-muted-foreground tabular-nums mb-1">
                          {formatStudioTime(cast.scheduledAt, {
                            locale: resolvedLocale,
                            timeZone: resolvedTimeZone,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {cast.account?.username ? ` · @${cast.account.username}` : ''}
                        </div>
                        <p className="text-[12px] line-clamp-3">{cast.content || 'Empty cast'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onDuplicateCast && (
                          <button
                            type="button"
                            title="Duplicate as draft"
                            aria-label="Duplicate as draft"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDuplicateCast(cast.id)
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && onDeleteCast && (
                          <button
                            type="button"
                            title="Delete cast"
                            aria-label="Delete cast"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation()
                              setDeleteTarget(cast)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DndContext>
  )
}

function CalendarDay({
  date,
  dateKey,
  casts,
  isCurrentMonth,
  isToday,
  onSelectDate,
  onSelectCast,
  onDuplicateCast,
  onDeleteCast,
  onRequestDelete,
  onOpenDayDetail,
  locale,
  timeZone,
}: {
  date: Date
  dateKey: string
  casts: Cast[]
  isCurrentMonth: boolean
  isToday: boolean
  onSelectDate?: (date: Date) => void
  onSelectCast?: (castId: string) => void
  onDuplicateCast?: (castId: string) => void
  onDeleteCast?: (castId: string) => void
  onRequestDelete?: (cast: Cast) => void
  onOpenDayDetail?: (dateKey: string) => void
  locale: string
  timeZone: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  })

  const statusIndicators = useMemo(() => {
    const buckets = new Map<string, { key: string; count: number }>()
    for (const cast of casts) {
      const key = cast.status
      const existing = buckets.get(key)
      if (existing) {
        existing.count += 1
      } else {
        buckets.set(key, { key, count: 1 })
      }
    }
    return Array.from(buckets.values()).sort((a, b) => b.count - a.count)
  }, [casts])

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] border-b border-r p-1 ${!isCurrentMonth ? 'bg-muted' : ''} ${isOver ? 'bg-castor-light' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onSelectDate?.(date)}
          aria-label={`Select ${formatStudioDate(date, {
            locale,
            timeZone,
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}`}
          className={`text-[12px] font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-primary/10 hover:text-primary ${isToday
            ? 'bg-castor-black text-white hover:bg-castor-black hover:text-white'
            : !isCurrentMonth
              ? 'text-muted-foreground'
              : 'text-foreground'
            }`}
        >
          {date.getDate()}
        </button>
        {statusIndicators.length > 0 && (
          <div className="flex items-center justify-end gap-1 overflow-hidden">
            {statusIndicators.slice(0, 3).map((indicator) => (
              <span
                key={indicator.key}
                title={STATUS_LABEL[indicator.key] ?? indicator.key}
                className={cn('size-2 rounded-full', getStatusDotClass(indicator.key))}
              />
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        {casts.slice(0, 2).map((cast) => (
          <DraggableCast
            key={cast.id}
            cast={cast}
            onSelectCast={onSelectCast}
            onDuplicateCast={onDuplicateCast}
            onDeleteCast={onDeleteCast}
            onRequestDelete={onRequestDelete}
            locale={locale}
            timeZone={timeZone}
          />
        ))}
        {casts.length > 2 && (
          <button
            type="button"
            onClick={() => onOpenDayDetail?.(dateKey)}
            className="text-[12px] text-muted-foreground pl-1 hover:text-foreground"
          >
            View all
          </button>
        )}
      </div>
    </div>
  )
}

function DraggableCast({
  cast,
  onSelectCast,
  onDuplicateCast,
  onDeleteCast,
  onRequestDelete,
  locale,
  timeZone,
}: {
  cast: Cast
  onSelectCast?: (castId: string) => void
  onDuplicateCast?: (castId: string) => void
  onDeleteCast?: (castId: string) => void
  onRequestDelete?: (cast: Cast) => void
  locale: string
  timeZone: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cast.id,
    disabled: cast.status !== 'scheduled',
  })

  const canDelete = ['draft', 'scheduled', 'retrying', 'failed'].includes(cast.status)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Open cast scheduled at ${formatStudioTime(cast.scheduledAt, {
        locale,
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
      })}`}
      className={`w-full text-left ${isDragging ? 'opacity-50' : ''}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isDragging && onSelectCast) {
          e.preventDefault()
          onSelectCast(cast.id)
        }
      }}
      onClick={(e) => {
        if (!isDragging && onSelectCast) {
          e.stopPropagation()
          onSelectCast(cast.id)
        }
      }}
    >
      <CastCard
        cast={cast}
        locale={locale}
        timeZone={timeZone}
        onDuplicate={() => onDuplicateCast?.(cast.id)}
        onDelete={canDelete && onDeleteCast ? () => onRequestDelete?.(cast) : undefined}
      />
    </div>
  )
}

function CastCard({
  cast,
  locale,
  timeZone,
  isDragging,
  onDuplicate,
  onDelete,
}: {
  cast: Cast
  locale: string
  timeZone: string
  isDragging?: boolean
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const time = formatStudioTime(cast.scheduledAt, {
    locale,
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'p-1.5 rounded border text-[12px] cursor-grab active:cursor-grabbing relative group',
        getStatusCardTone(cast.status),
        isDragging && 'shadow-lg rotate-2',
        cast.status !== 'scheduled' && 'cursor-default opacity-75'
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {cast.account?.pfpUrl ? (
            <img src={cast.account.pfpUrl} alt="" className="size-3.5 rounded-full shrink-0" />
          ) : (
            <div className="size-3.5 rounded-full bg-muted shrink-0" />
          )}
          <span className="truncate text-muted-foreground">
            {cast.account?.username ? `@${cast.account.username}` : 'Account'}
          </span>
        </div>
        <span className="text-muted-foreground tabular-nums shrink-0">{time}</span>
      </div>
      <p className="line-clamp-2 text-foreground">{cast.content}</p>
      {(onDuplicate || onDelete) && (
        <div className="mt-1 flex items-center justify-end gap-0.5">
          {onDuplicate && (
            <button
              type="button"
              title="Duplicate as draft"
              aria-label="Duplicate as draft"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title="Delete cast"
              aria-label="Delete cast"
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
