'use client'

import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewHeaderProps {
    title: React.ReactNode
    onBack?: () => void
    children?: React.ReactNode
    className?: string
    stickyTop?: string
}

export function ViewHeader({
    title,
    onBack,
    children,
    className,
    stickyTop = "top-0"
}: ViewHeaderProps) {
    return (
        <div className={cn(
            "sticky z-40 bg-background/95 backdrop-blur-sm border-b border-border/50",
            stickyTop,
            className
        )}>
            <div className="flex items-center gap-2 px-4 py-3">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors shrink-0"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}

                <div className="flex-1 min-w-0">
                    {typeof title === 'string' ? (
                        <h1 className="font-bold text-[17px] truncate">{title}</h1>
                    ) : (
                        title
                    )}
                </div>

                {children && (
                    <div className="flex items-center gap-2 shrink-0">
                        {children}
                    </div>
                )}
            </div>
        </div>
    )
}
