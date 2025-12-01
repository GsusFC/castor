import { Calendar, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface SchedulePickerProps {
  date: string
  time: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}

export function SchedulePicker({ date, time, onDateChange, onTimeChange }: SchedulePickerProps) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card className="p-4">
      <label className="block text-sm font-medium text-gray-700 mb-3">Programar para</label>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min={today}
            className="w-full h-10 pl-10 pr-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>
    </Card>
  )
}
