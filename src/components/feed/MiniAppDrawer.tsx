'use client'

import { X, Minus, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniAppDrawerProps {
  open: boolean
  onClose: () => void
  url: string | null
  title: string
}

export function MiniAppDrawer({ open, onClose, url, title }: MiniAppDrawerProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[400px] bg-background border-l border-border z-50 transition-transform duration-300 ease-out flex flex-col",
          "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{title || 'Mini App'}</span>
          </div>
          <div className="flex items-center gap-1">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Abrir en nueva pestaña"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Iframe container */}
        <div className="flex-1 bg-muted/30">
          {url && (
            <iframe
              src={url}
              className="w-full h-full border-0"
              allow="clipboard-write; web-share"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
            />
          )}
        </div>
      </div>
    </>
  )
}
