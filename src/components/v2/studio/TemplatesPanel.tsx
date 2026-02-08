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
  onLoadTemplate: (template: SerializedTemplate) => void
  onDeleteTemplate: (id: string) => void
}

export function TemplatesPanel({
  templates,
  onLoadTemplate,
  onDeleteTemplate,
}: TemplatesPanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{templates.length} templates</p>

      {templates.map(template => (
        <div
          key={template.id}
          className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{template.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 text-pretty">
              {template.content || 'Empty template'}
            </p>
            {template.channelId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium mt-1 inline-block">
                /{template.channelId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title="Load in composer"
              onClick={() => onLoadTemplate(template)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Pen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Delete template"
              onClick={() => setDeleteTarget(template.id)}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

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
              onClick={() => {
                if (deleteTarget) {
                  onDeleteTemplate(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
