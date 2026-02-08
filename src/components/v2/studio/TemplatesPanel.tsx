'use client'

import { useState } from 'react'
import { FileText, Pen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SerializedTemplate } from '@/types'

type TemplatesPanelProps = {
  templates: SerializedTemplate[]
  viewMode?: 'list' | 'grid'
  onLoadTemplate: (template: SerializedTemplate) => void
  onDeleteTemplate: (id: string) => void | Promise<void>
}

export function TemplatesPanel({
  templates,
  viewMode = 'grid',
  onLoadTemplate,
  onDeleteTemplate,
}: TemplatesPanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No templates yet</p>
        <p className="text-xs text-muted-foreground/70">Save templates from the composer to reuse content</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-muted-foreground px-1">{templates.length} templates</p>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5' : 'space-y-2.5'}>
        {templates.map(template => (
          <div
            key={template.id}
            className="group p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold truncate">{template.name}</p>
              <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title="Load in composer"
                  onClick={() => onLoadTemplate(template)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
                  disabled={deletingId === template.id}
                >
                  <Pen className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete template"
                  onClick={() => setDeleteTarget(template.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  disabled={deletingId === template.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-3 text-pretty">
              {template.content || 'Empty template'}
            </p>

            <div className="mt-2 flex items-center gap-2">
              {template.channelId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  /{template.channelId}
                </span>
              )}
              {template.accountId && (
                <span className="text-[10px] text-muted-foreground">acct {template.accountId.slice(0, 6)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              This will permanently delete the template. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!deleteTarget || deletingId === deleteTarget}
              onClick={async () => {
                if (!deleteTarget) return
                try {
                  setDeletingId(deleteTarget)
                  await onDeleteTemplate(deleteTarget)
                  setDeleteTarget(null)
                } finally {
                  setDeletingId(null)
                }
              }}
            >
              {deleteTarget && deletingId === deleteTarget ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
