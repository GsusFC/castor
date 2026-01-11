"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined)

function useTooltip() {
  const context = React.useContext(TooltipContext)
  if (!context) {
    throw new Error("Tooltip components must be used within Tooltip")
  }
  return context
}

interface TooltipProps {
  children: React.ReactNode
}

const Tooltip = ({ children }: TooltipProps) => {
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
  children: React.ReactNode
}

const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ asChild, children, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const { setOpen } = useTooltip()

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      setOpen(true)
      onMouseEnter?.(e as any)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      setOpen(false)
      onMouseLeave?.(e as any)
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ref,
        ...props,
      } as any)
    }

    return (
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ side = "bottom", className, children, ...props }, ref) => {
    const { open } = useTooltip()

    if (!open) return null

    const sideClasses = {
      top: "-top-2 -translate-y-full left-1/2 -translate-x-1/2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full -translate-x-2 top-1/2 -translate-y-1/2",
      right: "left-full translate-x-2 top-1/2 -translate-y-1/2",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-md shadow-lg whitespace-nowrap pointer-events-none",
          sideClasses[side],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipContent.displayName = "TooltipContent"

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
