'use client'

import { useState, useMemo } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ScheduleDropdownProps {
  date: string
  time: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  label: string | null
}

export function ScheduleDropdown({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
}: ScheduleDropdownProps) {
  const [open, setOpen] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  // Formatear label
  const displayLabel = useMemo(() => {
    if (!date || !time) return null

    const dateObj = new Date(`${date}T${time}:00`)
    const formatted = dateObj.toLocaleString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

    return formatted
  }, [date, time])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1",
            !displayLabel && "text-gray-500"
          )}
        >
          <Clock className="w-3 h-3" />
          <span className="max-w-[140px] truncate">
            {displayLabel || 'Programar'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          {/* Fecha */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              min={today}
              className="w-full h-9 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* Hora */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Hora
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full h-9 px-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* Zona horaria */}
          <p className="text-xs text-gray-400 text-center">
            Hora de Madrid (Europe/Madrid)
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
