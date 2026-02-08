'use client'

import { useState, useMemo, useCallback } from 'react'
import { Clock, ChevronDown, Globe, X } from 'lucide-react'
import { addHours, addDays, nextMonday, setHours, setMinutes, startOfDay, isBefore, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

interface ScheduleDropdownProps {
  date: string
  time: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  label: string | null
}

// ─── Quick picks ──────────────────────────────────────────────────────────────

interface QuickPick {
  label: string
  getDate: () => Date
}

function getQuickPicks(): QuickPick[] {
  const now = new Date()
  return [
    { label: '1h', getDate: () => roundToNext5(addHours(now, 1)) },
    { label: '3h', getDate: () => roundToNext5(addHours(now, 3)) },
    { label: 'Tom 9am', getDate: () => setMinutes(setHours(addDays(startOfDay(now), 1), 9), 0) },
    { label: 'Tom 12pm', getDate: () => setMinutes(setHours(addDays(startOfDay(now), 1), 12), 0) },
    { label: 'Mon 9am', getDate: () => setMinutes(setHours(nextMonday(now), 9), 0) },
  ]
}

/** Round minutes up to next 5 */
function roundToNext5(d: Date): Date {
  const mins = d.getMinutes()
  const rounded = Math.ceil(mins / 5) * 5
  const result = new Date(d)
  result.setMinutes(rounded, 0, 0)
  return result
}

function formatDateToString(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function formatTimeToString(d: Date): string {
  return format(d, 'HH:mm')
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleDropdown({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
}: ScheduleDropdownProps) {
  const [open, setOpen] = useState(false)

  // Parse date string to Date object for calendar
  const selectedDate = useMemo(() => {
    if (!date) return undefined
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [date])

  // Display label
  const displayLabel = useMemo(() => {
    if (!date || !time) return null

    const dateObj = new Date(`${date}T${time}:00`)
    return format(dateObj, 'MMM d · HH:mm')
  }, [date, time])

  // Quick pick handler
  const handleQuickPick = useCallback((pick: QuickPick) => {
    const d = pick.getDate()
    onDateChange(formatDateToString(d))
    onTimeChange(formatTimeToString(d))
  }, [onDateChange, onTimeChange])

  // Calendar select handler
  const handleCalendarSelect = useCallback((day: Date | undefined) => {
    if (!day) return
    onDateChange(formatDateToString(day))
    // If no time set yet, default to next round hour
    if (!time) {
      const now = new Date()
      const nextHour = addHours(now, 1)
      nextHour.setMinutes(0, 0, 0)
      onTimeChange(formatTimeToString(nextHour))
    }
  }, [onDateChange, onTimeChange, time])

  // Time input handlers
  const handleHourChange = useCallback((delta: number) => {
    const [h, m] = (time || '12:00').split(':').map(Number)
    const newH = ((h + delta) + 24) % 24
    onTimeChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }, [time, onTimeChange])

  const handleMinuteChange = useCallback((delta: number) => {
    const [h, m] = (time || '12:00').split(':').map(Number)
    const newM = ((m + delta) + 60) % 60
    onTimeChange(`${String(h).padStart(2, '0')}:${String(newM).padStart(2, '0')}`)
  }, [time, onTimeChange])

  const handleHourInput = useCallback((value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num > 23) return
    const [, m] = (time || '12:00').split(':').map(Number)
    onTimeChange(`${String(num).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }, [time, onTimeChange])

  const handleMinuteInput = useCallback((value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num > 59) return
    const [h] = (time || '12:00').split(':').map(Number)
    onTimeChange(`${String(h).padStart(2, '0')}:${String(num).padStart(2, '0')}`)
  }, [time, onTimeChange])

  // Clear
  const handleClear = useCallback(() => {
    onDateChange('')
    onTimeChange('')
  }, [onDateChange, onTimeChange])

  const today = startOfDay(new Date())
  const [currentHour, currentMinute] = (time || '12:00').split(':').map(Number)

  // Timezone display
  const tzLabel = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const offset = new Date().getTimezoneOffset()
      const sign = offset <= 0 ? '+' : '-'
      const absH = Math.floor(Math.abs(offset) / 60)
      const absM = Math.abs(offset) % 60
      const offsetStr = absM > 0 ? `${sign}${absH}:${String(absM).padStart(2, '0')}` : `${sign}${absH}`
      return `${tz.replace(/_/g, ' ')} (UTC${offsetStr})`
    } catch {
      return 'Local time'
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5',
            !displayLabel && 'text-muted-foreground'
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="max-w-[140px] truncate">
            {displayLabel || 'Schedule'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
        <div className="p-3 space-y-3">
          {/* ── Quick picks ── */}
          <div className="grid grid-cols-3 gap-1.5">
            {getQuickPicks().map((pick) => (
              <button
                key={pick.label}
                onClick={() => handleQuickPick(pick)}
                className={cn(
                  'px-2 py-1.5 rounded-md text-xs font-medium text-center transition-colors',
                  'bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary',
                  'border border-transparent hover:border-primary/20'
                )}
              >
                {pick.label}
              </button>
            ))}
          </div>

          {/* ── Calendar ── */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            disabled={(day) => isBefore(day, today)}
            weekStartsOn={1}
          />

          {/* ── Time picker ── */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Time
            </label>
            <div className="flex items-center justify-center gap-1">
              {/* Hour */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleHourChange(1)}
                  className="w-10 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors text-xs"
                  aria-label="Increase hour"
                >
                  ▲
                </button>
                <input
                  type="text"
                  value={String(currentHour).padStart(2, '0')}
                  onChange={(e) => handleHourInput(e.target.value)}
                  className="w-10 h-9 text-center text-sm font-mono font-medium rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={2}
                />
                <button
                  onClick={() => handleHourChange(-1)}
                  className="w-10 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors text-xs"
                  aria-label="Decrease hour"
                >
                  ▼
                </button>
              </div>

              <span className="text-lg font-medium text-muted-foreground pb-0.5">:</span>

              {/* Minute */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleMinuteChange(5)}
                  className="w-10 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors text-xs"
                  aria-label="Increase minutes"
                >
                  ▲
                </button>
                <input
                  type="text"
                  value={String(currentMinute).padStart(2, '0')}
                  onChange={(e) => handleMinuteInput(e.target.value)}
                  className="w-10 h-9 text-center text-sm font-mono font-medium rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={2}
                />
                <button
                  onClick={() => handleMinuteChange(-5)}
                  className="w-10 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors text-xs"
                  aria-label="Decrease minutes"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>

          {/* ── Timezone + Clear ── */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Globe className="w-2.5 h-2.5" />
              <span className="truncate max-w-[180px]">{tzLabel}</span>
            </div>
            {(date || time) && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
