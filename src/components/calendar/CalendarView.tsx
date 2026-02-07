'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
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
  locale,
  timeZone,
  weekStartsOn = DEFAULT_WEEK_STARTS_ON,
}: CalendarViewProps) {
  const resolvedLocale = locale || getStudioLocale()
  const resolvedTimeZone = timeZone || getStudioTimeZone()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeCast, setActiveCast] = useState<Cast | null>(null)
  const [optimisticCasts, setOptimisticCasts] = useState<Cast[]>(casts)

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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-card rounded-xl border">
        <div className="flex items-center justify-between p-4 border-b">
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

        <div className="grid grid-cols-7 border-b">
          {WEEKDAY_LABELS[weekStartsOn].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
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
          <DraggableCast key={cast.id} cast={cast} onSelectCast={onSelectCast} locale={locale} timeZone={timeZone} />
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
  locale,
  timeZone,
}: {
  cast: Cast
  onSelectCast?: (castId: string) => void
  locale: string
  timeZone: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cast.id,
    disabled: cast.status !== 'scheduled',
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Open cast scheduled at ${formatStudioTime(cast.scheduledAt, {
        locale,
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
      })}`}
      className={`w-full text-left ${isDragging ? 'opacity-50' : ''}`}
      onClick={(e) => {
        if (!isDragging && onSelectCast) {
          e.stopPropagation()
          onSelectCast(cast.id)
        }
      }}
    >
      <CastCard cast={cast} locale={locale} timeZone={timeZone} />
    </button>
  )
}

function CastCard({
  cast,
  locale,
  timeZone,
  isDragging,
}: {
  cast: Cast
  locale: string
  timeZone: string
  isDragging?: boolean
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
        }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Clock className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">{time}</span>
      </div>
      <p className="line-clamp-2 text-foreground">{cast.content}</p>
    </div>
  )
}
