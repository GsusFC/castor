'use client'

import { useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Link as LinkIcon, Copy, Check, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseRendererProps, RemovableProps, EmbedMetadata } from '../types'

interface LinkRendererProps extends BaseRendererProps, RemovableProps {
  url: string
  // Metadata precargada (del composer)
  metadata?: EmbedMetadata
  // Para frames/miniapps
  isFrame?: boolean
  // Vista compacta para móvil
  compact?: boolean
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchMetadata(url: string): Promise<EmbedMetadata | null> {
  try {
    if (!isHttpUrl(url)) return null
    const params = new URLSearchParams({ url })
    const response = await fetch(`/api/embeds/metadata?${params.toString()}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.metadata
  } catch {
    return null
  }
}

function getDisplayUrl(url: string): { domain: string; path: string } {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname ? urlObj.hostname.replace('www.', '') : urlObj.protocol.replace(':', '')
    const path = urlObj.pathname.length > 1 ? urlObj.pathname : ''
    return { domain, path }
  } catch {
    return { domain: url, path: '' }
  }
}

// Skeleton
function LinkSkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/50 max-w-lg animate-pulse">
      <div className="h-8 w-8 rounded-md bg-muted/50 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-3/4 rounded bg-muted/50" />
        <div className="h-4 w-full rounded bg-muted/50" />
      </div>
    </div>
  )
}

export function LinkRenderer({ 
  url, 
  metadata: preloadedMetadata,
  isFrame = false,
  className,
  onRemove,
  showRemove = false,
  compact = false,
}: LinkRendererProps) {
  const [copied, setCopied] = useState(false)
  const [faviconError, setFaviconError] = useState(false)

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '500px',
  })

  // Solo hacer fetch si no tenemos metadata precargada
  const { data: fetchedMetadata, isLoading } = useQuery({
    queryKey: ['embed-metadata', url],
    queryFn: () => fetchMetadata(url),
    enabled: inView && !preloadedMetadata && !!url && isHttpUrl(url),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  })

  const metadata = preloadedMetadata || fetchedMetadata
  const { domain } = getDisplayUrl(url)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Loading
  if (!inView || (isLoading && !preloadedMetadata)) {
    return <div ref={ref} className={className}><LinkSkeleton /></div>
  }

  // Frame / MiniApp
  if (isFrame || metadata?.isFrame) {
    // Versión compacta: miniatura cuadrada
    if (compact) {
      return (
        <div 
          ref={ref}
          className={cn(
            'relative w-16 h-16 flex-shrink-0 border rounded-lg overflow-hidden bg-card group border-purple-500/30',
            className
          )}
        >
          {(metadata?.frameImage || metadata?.image) ? (
            <img
              src={metadata.frameImage || metadata.image}
              alt={metadata.title || 'Mini App'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-purple-500/10">
              <Zap className="w-6 h-6 text-purple-500" />
            </div>
          )}
          <div className="absolute top-1 left-1 px-1 py-0.5 bg-purple-500 text-white text-[8px] font-medium rounded">
            <Zap className="w-2 h-2 inline" />
          </div>
          {showRemove && onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
              aria-label="Eliminar"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )
    }

    // Versión completa
    return (
      <div 
        ref={ref}
        className={cn(
          'relative border rounded-lg overflow-hidden bg-card group border-purple-500/30',
          className
        )}
      >
        {/* Badge */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-purple-500 text-white text-xs font-medium rounded-full">
          <Zap className="w-3 h-3" />
          <span>Mini App</span>
        </div>

        {/* Image */}
        {(metadata?.frameImage || metadata?.image) && (
          <div className="aspect-[1.91/1] bg-muted overflow-hidden">
            <img
              src={metadata.frameImage || metadata.image}
              alt={metadata.title || 'Mini App'}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          {metadata?.favicon && (
            <div className="flex items-center gap-2 mb-1">
              <img src={metadata.favicon} alt="" className="w-4 h-4" />
              <span className="text-xs text-muted-foreground">{metadata.siteName || domain}</span>
            </div>
          )}
          {metadata?.title && (
            <h4 className="font-medium text-sm text-foreground line-clamp-2">{metadata.title}</h4>
          )}
          {metadata?.frameButtons && metadata.frameButtons.length > 0 && (
            <div className="flex gap-2 mt-2">
              {metadata.frameButtons.map((btn, i) => (
                <div key={i} className="flex-1 px-3 py-1.5 text-xs font-medium text-center bg-muted rounded-md text-muted-foreground">
                  {btn}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remove */}
        {showRemove && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Eliminar"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  // Versión compacta para links
  if (compact) {
    return (
      <div 
        ref={ref}
        className={cn(
          'relative w-16 h-16 flex-shrink-0 border rounded-lg overflow-hidden bg-muted/30 group',
          className
        )}
      >
        {metadata?.image ? (
          <img src={metadata.image} alt="" className="w-full h-full object-cover" />
        ) : metadata?.favicon && !faviconError ? (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <img src={metadata.favicon} alt="" className="w-8 h-8" onError={() => setFaviconError(true)} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <LinkIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        {showRemove && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
            aria-label="Eliminar"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    )
  }

  // Sin metadata: link simple
  if (!metadata?.title) {
    return (
      <a 
        ref={ref}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 max-w-lg group hover:bg-muted/50 transition-colors no-underline',
          className
        )}
      >
        <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">{domain}</span>
        <div className="flex items-center gap-1 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-muted" aria-label="Copiar enlace">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {showRemove && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
            className="p-1 hover:bg-muted rounded"
            aria-label="Eliminar"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </a>
    )
  }

  // Rich preview
  return (
    <a 
      ref={ref}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/50 max-w-lg group hover:bg-muted/50 transition-colors no-underline',
        className
      )}
    >
      {/* Favicon */}
      <div className="flex-shrink-0">
        {metadata.favicon && !faviconError ? (
          <img src={metadata.favicon} alt="" className="h-8 w-8 rounded-md" onError={() => setFaviconError(true)} />
        ) : (
          <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-[11px] text-muted-foreground truncate leading-tight">{domain}</p>
        <p className="text-sm font-medium text-foreground truncate leading-snug">{metadata.title}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-muted" aria-label="Copiar enlace">
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {showRemove && onRemove && (
          <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }} className="p-1.5 rounded-md hover:bg-muted" aria-label="Eliminar">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
    </a>
  )
}
