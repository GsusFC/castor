'use client'

import { useState } from 'react'
import { ChevronDown, LayoutTemplate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface TemplateDropdownProps {
  templates: Template[]
  onSelect: (template: Template) => void
}

export function TemplateDropdown({
  templates,
  onSelect,
}: TemplateDropdownProps) {
  const [open, setOpen] = useState(false)

  if (templates.length === 0) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-gray-500"
          aria-label="Seleccionar template"
        >
          <LayoutTemplate className="w-3 h-3" />
          <span className="hidden sm:inline">Templates</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="text-xs font-medium text-gray-500 mb-2 px-2">
          Plantillas guardadas
        </p>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelect(template)
                setOpen(false)
              }}
              className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1"
            >
              <p className="text-sm font-medium truncate">{template.name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {template.content}
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
