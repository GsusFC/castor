'use client'

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  current: number
  max: number
}

export function ProgressBar({ current, max }: ProgressBarProps) {
  const percentage = Math.min((current / max) * 100, 100)
  const isOverLimit = current > max
  const hasContent = current > 0

  return (
    <div className="h-1 w-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full transition-all duration-200 ease-out",
          isOverLimit 
            ? "bg-destructive shadow-[0_0_4px_1px] shadow-destructive/40" 
            : "bg-primary shadow-[0_0_4px_1px] shadow-primary/40",
          !hasContent && "shadow-none"
        )}
        style={{ width: `${percentage}%` }}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${current} de ${max} caracteres`}
      />
    </div>
  )
}
