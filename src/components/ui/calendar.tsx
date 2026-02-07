'use client'

import * as React from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      className={cn('p-0', className)}
      classNames={{
        months: 'flex flex-col',
        month: 'space-y-2',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center justify-between absolute inset-x-0',
        button_previous: cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
        ),
        button_next: cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]',
        week: 'flex w-full mt-1',
        day: cn(
          'relative p-0 text-center text-sm',
          'focus-within:relative focus-within:z-20',
          `${defaultClassNames.day}`
        ),
        day_button: cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-md',
          'text-sm font-normal transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'aria-selected:opacity-100'
        ),
        selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md',
        today: 'bg-accent text-accent-foreground rounded-md',
        outside: 'text-muted-foreground/40',
        disabled: 'text-muted-foreground/30 cursor-not-allowed hover:bg-transparent',
        hidden: 'invisible',
        chevron: 'w-4 h-4',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
