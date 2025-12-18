'use client'

import type { MouseEvent } from 'react'
import { Edit, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

interface Draft {
  id: string
  content: string
  accountId: string
  channelId: string | null
  scheduledAt: string
  account: { username: string; pfpUrl: string | null } | null
}

interface MobileNavDraftsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drafts: Draft[]
  isLoading: boolean
  onEditDraft: (draftId: string) => void
  onDeleteDraft: (e: MouseEvent, draftId: string) => void
}

export function MobileNavDraftsSheet({
  open,
  onOpenChange,
  drafts,
  isLoading,
  onEditDraft,
  onDeleteDraft,
}: MobileNavDraftsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">Drafts</SheetTitle>
            <span className="text-xs text-muted-foreground">({drafts.length})</span>
          </div>
        </div>
        <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-6">Loading...</p>
          ) : drafts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No drafts</p>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <button
                  onClick={() => onEditDraft(draft.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left"
                >
                  {draft.account?.pfpUrl ? (
                    <img src={draft.account.pfpUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                  )}
                  <p className="flex-1 min-w-0 text-sm truncate">
                    {draft.content || <span className="text-muted-foreground italic">Empty</span>}
                  </p>
                  <Edit className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
                <button
                  onClick={(e) => onDeleteDraft(e, draft.id)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded shrink-0"
                  aria-label="Delete draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
