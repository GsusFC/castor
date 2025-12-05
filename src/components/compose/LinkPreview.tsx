'use client'

import { X, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { LinkEmbed } from './types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LinkPreviewProps {
  link: LinkEmbed
  onRemove: () => void
}

export function LinkPreview({ link, onRemove }: LinkPreviewProps) {
  // Estado de carga
  if (link.loading) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate">{link.url}</span>
      </div>
    )
  }

  // Estado de error o sin metadata
  if (link.error || (!link.title && !link.image)) {
    return (
      <div className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-muted/50 group">
        <div className="flex items-center gap-2 min-w-0">
          {link.favicon ? (
            <img src={link.favicon} alt="" className="w-4 h-4 shrink-0" />
          ) : (
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm text-foreground truncate">{link.siteName || link.url}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  // Preview completo
  return (
    <div className="relative group border rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow">
      {/* Botón eliminar */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="absolute top-2 right-2 h-6 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="w-3 h-3" />
      </Button>

      {/* Imagen de preview */}
      {link.image && (
        <div className="aspect-[1.91/1] bg-muted overflow-hidden max-h-48">
          <img
            src={link.image}
            alt={link.title || ''}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )}

      {/* Contenido */}
      <div className="p-3">
        {/* Site info */}
        <div className="flex items-center gap-2 mb-1">
          {link.favicon && (
            <img 
              src={link.favicon} 
              alt="" 
              className="w-4 h-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <span className="text-xs text-muted-foreground truncate">
            {link.siteName}
          </span>
        </div>

        {/* Título */}
        {link.title && (
          <h4 className="font-medium text-sm text-foreground line-clamp-2">
            {link.title}
          </h4>
        )}

        {/* Descripción */}
        {link.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {link.description}
          </p>
        )}
      </div>
    </div>
  )
}
