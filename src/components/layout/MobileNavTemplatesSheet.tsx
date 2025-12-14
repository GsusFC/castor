'use client'

import type { MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

interface Template {
  id: string
  name: string
  content: string
  channelId: string | null
  accountId: string
}

interface MobileNavTemplatesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: Template[]
  isLoading: boolean
  onUseTemplate: (template: Template) => void
  onDeleteTemplate: (e: MouseEvent, templateId: string) => void
}

export function MobileNavTemplatesSheet({
  open,
  onOpenChange,
  templates,
  isLoading,
  onUseTemplate,
  onDeleteTemplate,
}: MobileNavTemplatesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">Templates</SheetTitle>
            <span className="text-xs text-muted-foreground">({templates.length})</span>
          </div>
        </div>
        <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-6">Cargando...</p>
          ) : templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No hay templates</p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="w-full flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <button
                  onClick={() => onUseTemplate(template)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.content}</p>
                  {template.channelId && (
                    <span className="text-xs text-purple-600">#{template.channelId}</span>
                  )}
                </button>
                <button
                  onClick={(e) => onDeleteTemplate(e, template.id)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded shrink-0"
                  aria-label="Eliminar template"
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
