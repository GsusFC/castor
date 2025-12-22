'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, LayoutTemplate, Settings, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface MobileNavMoreSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenDrafts: () => void
  onOpenTemplates: () => void
}

export function MobileNavMoreSheet({
  open,
  onOpenChange,
  onOpenDrafts,
  onOpenTemplates,
}: MobileNavMoreSheetProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-4">
        <SheetHeader className="sr-only">
          <SheetTitle>More</SheetTitle>
        </SheetHeader>

        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-semibold">More</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/accounts"
            onClick={() => onOpenChange(false)}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium transition-colors hover:bg-muted/50',
              pathname.startsWith('/accounts') && 'border-primary/40'
            )}
            aria-label="Go to Accounts"
          >
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>Accounts</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => onOpenChange(false)}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium transition-colors hover:bg-muted/50',
              pathname.startsWith('/settings') && 'border-primary/40'
            )}
            aria-label="Go to Settings"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span>Settings</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onOpenDrafts()
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50"
            aria-label="Open drafts"
          >
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>Drafts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onOpenTemplates()
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50"
            aria-label="Open templates"
          >
            <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
            <span>Templates</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
