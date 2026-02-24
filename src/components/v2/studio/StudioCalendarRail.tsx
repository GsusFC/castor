'use client'

import { Calendar, PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StudioCalendarRailProps {
  todayLabel: string
  scheduledCount: number
  publishedCount: number
  onExpand: () => void
}

export function StudioCalendarRail({
  todayLabel,
  scheduledCount,
  publishedCount,
  onExpand,
}: StudioCalendarRailProps) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-3 py-2">
      <button
        type="button"
        onClick={onExpand}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Expand calendar"
        aria-label="Expand calendar"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>

      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#B89C7A]/60 bg-[#B89C7A]/10 text-[#B89C7A]">
        <Calendar className="h-4 w-4" />
      </div>

      <div className="px-1 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
        <p className="mt-0.5 text-[11px] font-medium text-foreground">{todayLabel}</p>
      </div>

      <div className="mt-auto mb-2 flex w-full flex-col items-center gap-1 px-1">
        <div
          className={cn(
            'w-full rounded-md border border-blue-500/40 bg-blue-500/10 px-1 py-1 text-center text-[10px] font-semibold text-blue-200'
          )}
          title={`${scheduledCount} scheduled today`}
          aria-label={`${scheduledCount} scheduled today`}
        >
          S {scheduledCount}
        </div>
        <div
          className={cn(
            'w-full rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1 py-1 text-center text-[10px] font-semibold text-emerald-200'
          )}
          title={`${publishedCount} published today`}
          aria-label={`${publishedCount} published today`}
        >
          P {publishedCount}
        </div>
      </div>
    </div>
  )
}
