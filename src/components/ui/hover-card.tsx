'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface HoverCardProps {
  children: React.ReactNode
  openDelay?: number
  onOpenChange?: (open: boolean) => void
}

interface HoverCardTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

interface HoverCardContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
}

const HoverCardContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({ open: false, setOpen: () => {} })

export function HoverCard({ children, openDelay = 200, onOpenChange }: HoverCardProps) {
  const [open, setOpen] = React.useState<boolean>(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleSetOpen = (newOpen: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    if (newOpen) {
      timeoutRef.current = setTimeout(() => {
        setOpen(true)
        onOpenChange?.(true)
      }, openDelay)
    } else {
      timeoutRef.current = setTimeout(() => {
        setOpen(false)
        onOpenChange?.(false)
      }, 100)
    }
  }

  return (
    <HoverCardContext.Provider value={{ open, setOpen: handleSetOpen }}>
      <div 
        className="relative inline-block"
        onMouseEnter={() => handleSetOpen(true)}
        onMouseLeave={() => handleSetOpen(false)}
      >
        {children}
      </div>
    </HoverCardContext.Provider>
  )
}

export function HoverCardTrigger({ children, asChild }: HoverCardTriggerProps) {
  return <>{children}</>
}

export function HoverCardContent({ children, className, align = 'start' }: HoverCardContentProps) {
  const { open } = React.useContext(HoverCardContext)

  if (!open) return null

  return (
    <div 
      className={cn(
        "absolute z-50 mt-2 p-4 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95",
        align === 'start' && "left-0",
        align === 'center' && "left-1/2 -translate-x-1/2",
        align === 'end' && "right-0",
        className
      )}
    >
      {children}
    </div>
  )
}
