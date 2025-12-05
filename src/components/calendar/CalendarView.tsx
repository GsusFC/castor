'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react'
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
}

export function CalendarView({ casts, onMoveCast }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeCast, setActiveCast] = useState<Cast | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Obtener días del mes actual
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days: Date[] = []
    
    // Días del mes anterior para completar la primera semana
    const startDayOfWeek = firstDay.getDay()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i))
    }
    
    // Días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    
    // Días del mes siguiente para completar la última semana
    const remainingDays = 42 - days.length // 6 semanas * 7 días
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }
    
    return days
  }, [currentDate])

  // Agrupar casts por día
  const castsByDay = useMemo(() => {
    const map = new Map<string, Cast[]>()
    
    casts.forEach((cast) => {
      const date = new Date(cast.scheduledAt)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(cast)
    })
    
    return map
  }, [casts])

  const handleDragStart = (event: DragStartEvent) => {
    const cast = casts.find((c) => c.id === event.active.id)
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
    
    // Parsear la fecha del día destino
    const [year, month, day] = targetDateStr.split('-').map(Number)
    const cast = casts.find((c) => c.id === castId)
    
    if (!cast) return
    
    // Mantener la hora original, solo cambiar el día
    const originalDate = new Date(cast.scheduledAt)
    const newDate = new Date(
      year,
      month,
      day,
      originalDate.getHours(),
      originalDate.getMinutes()
    )
    
    // Solo mover si es un cast programado (no publicado)
    if (cast.status === 'scheduled') {
      await onMoveCast(castId, newDate)
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">
            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) => {
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            const dayCasts = castsByDay.get(dateKey) || []

            return (
              <CalendarDay
                key={index}
                date={date}
                dateKey={dateKey}
                casts={dayCasts}
                isCurrentMonth={isCurrentMonth(date)}
                isToday={isToday(date)}
              />
            )
          })}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeCast && <CastCard cast={activeCast} isDragging />}
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
}: {
  date: Date
  dateKey: string
  casts: Cast[]
  isCurrentMonth: boolean
  isToday: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] border-b border-r p-1 ${
        !isCurrentMonth ? 'bg-muted' : ''
      } ${isOver ? 'bg-castor-light' : ''}`}
    >
      <div
        className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
          isToday
            ? 'bg-castor-black text-white'
            : !isCurrentMonth
            ? 'text-muted-foreground'
            : 'text-foreground'
        }`}
      >
        {date.getDate()}
      </div>
      <div className="space-y-1">
        {casts.slice(0, 3).map((cast) => (
          <DraggableCast key={cast.id} cast={cast} />
        ))}
        {casts.length > 3 && (
          <div className="text-xs text-muted-foreground pl-1">
            +{casts.length - 3} más
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableCast({ cast }: { cast: Cast }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cast.id,
    disabled: cast.status !== 'scheduled',
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-50' : ''}
    >
      <CastCard cast={cast} />
    </div>
  )
}

function CastCard({ cast, isDragging }: { cast: Cast; isDragging?: boolean }) {
  const statusColors = {
    scheduled: 'bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/20 dark:border-blue-500/30',
    published: 'bg-green-500/10 border-green-500/20 dark:bg-green-500/20 dark:border-green-500/30',
    failed: 'bg-red-500/10 border-red-500/20 dark:bg-red-500/20 dark:border-red-500/30',
  }

  const time = new Date(cast.scheduledAt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })

  return (
    <div
      className={`p-1.5 rounded border text-xs cursor-grab active:cursor-grabbing ${
        statusColors[cast.status as keyof typeof statusColors] || 'bg-muted border-border'
      } ${isDragging ? 'shadow-lg rotate-2' : ''} ${
        cast.status !== 'scheduled' ? 'cursor-default opacity-75' : ''
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
