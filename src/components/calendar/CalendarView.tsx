'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Clock, Copy, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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

  const [currentDate, setCurrentDate] = useState(new Date())
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date())
  const [activeCast, setActiveCast] = useState<Cast | null>(null)
  const [optimisticCasts, setOptimisticCasts] = useState<Cast[]>(casts)
  const [deleteTarget, setDeleteTarget] = useState<Cast | null>(null)

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
      <div className="bg-card rounded-xl border">
        <div className="hidden md:flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">
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
              className="px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
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
            <div className="text-sm font-medium">
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
                className="px-2 py-1 text-xs font-medium hover:bg-muted rounded-md transition-colors"
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
                  <div className="text-[10px] text-muted-foreground">
                    {formatStudioDate(date, { locale: resolvedLocale, timeZone: resolvedTimeZone, weekday: 'short' })}
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{date.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground">{dayCount > 0 ? dayCount : '·'}</div>
                </button>
              )
            })}
          </div>

          <div className="pt-1 space-y-1.5">
            {mobileAgendaCasts.length === 0 ? (
              <div className="text-xs text-muted-foreground px-1 py-2">No casts for this day</div>
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
                  <div className="text-xs tabular-nums text-muted-foreground min-w-[44px]">
                    {formatStudioTime(cast.scheduledAt, {
                      locale: resolvedLocale,
                      timeZone: resolvedTimeZone,
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs line-clamp-2">{cast.content || 'Empty cast'}</p>
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
              className="py-2 text-center text-sm font-medium text-muted-foreground"
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
  locale: string
  timeZone: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] border-b border-r p-1 ${!isCurrentMonth ? 'bg-muted' : ''} ${isOver ? 'bg-castor-light' : ''}`}
    >
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
        className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-primary/10 hover:text-primary ${isToday
          ? 'bg-castor-black text-white hover:bg-castor-black hover:text-white'
          : !isCurrentMonth
            ? 'text-muted-foreground'
            : 'text-foreground'
          }`}
      >
        {date.getDate()}
      </button>
      <div className="space-y-1">
        {casts.slice(0, 3).map((cast) => (
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
        {casts.length > 3 && (
          <div className="text-xs text-muted-foreground pl-1">
            +{casts.length - 3} more
          </div>
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
  const statusColors = {
    scheduled: 'bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/20 dark:border-blue-500/30',
    published: 'bg-green-500/10 border-green-500/20 dark:bg-green-500/20 dark:border-green-500/30',
    failed: 'bg-red-500/10 border-red-500/20 dark:bg-red-500/20 dark:border-red-500/30',
  }

  const time = formatStudioTime(cast.scheduledAt, {
    locale,
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={`p-1.5 rounded border text-xs cursor-grab active:cursor-grabbing ${statusColors[cast.status as keyof typeof statusColors] || 'bg-muted border-border'
        } ${isDragging ? 'shadow-lg rotate-2' : ''} ${cast.status !== 'scheduled' ? 'cursor-default opacity-75' : ''
        } relative group pr-12`}
    >
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="flex items-center gap-1 mb-0.5">
        <Clock className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">{time}</span>
      </div>
      <p className="line-clamp-2 text-foreground">{cast.content}</p>
    </div>
  )
}
