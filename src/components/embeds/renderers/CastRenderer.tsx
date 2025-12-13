'use client'

import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseRendererProps, RemovableProps, EmbedCast } from '../types'

interface CastRendererProps extends BaseRendererProps, RemovableProps {
  // Puede recibir el cast directamente o la URL para hacer fetch
  cast?: EmbedCast
  url?: string
}

// Parsear URL de Farcaster para obtener username y hash
function parseFarcasterUrl(url: string): { username: string; hash: string } | null {
  const pattern = /(?:warpcast\.com|farcaster\.xyz)\/([^\/]+)\/(0x[a-f0-9]+)/i
  const match = url.match(pattern)
  return match ? { username: match[1], hash: match[2] } : null
}

export function CastRenderer({ 
  cast: initialCast,
  url,
  className,
  onRemove,
  showRemove = false,
}: CastRendererProps) {
  const [cast, setCast] = useState<EmbedCast | null>(initialCast || null)
  const [loading, setLoading] = useState(!initialCast && !!url)
  const [error, setError] = useState(false)
  const hydrationAttemptedRef = useRef(false)

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '200px',
  })

  // Reset de la rehidratación si cambia el input
  useEffect(() => {
    hydrationAttemptedRef.current = false
  }, [url, initialCast?.hash])

  // Fetch cast si tenemos URL pero no cast, o si el cast viene incompleto
  useEffect(() => {
    if (!inView) return

    const needsFetchByUrl = !initialCast && !!url
    const castMissingAuthor = !!cast && (!cast.author || !cast.author.username || !cast.author.display_name)
    const needsHydrationByHash = castMissingAuthor && !!cast?.hash && !hydrationAttemptedRef.current

    if (!needsFetchByUrl && !needsHydrationByHash) return

    const fetchCast = async () => {
      setLoading(true)
      try {
        const identifier = needsFetchByUrl ? url! : cast!.hash
        const type = needsFetchByUrl ? 'url' : 'hash'
        if (!needsFetchByUrl) hydrationAttemptedRef.current = true

        const params = new URLSearchParams({ identifier, type })
        const response = await fetch(`/api/casts/lookup?${params.toString()}`)
        
        if (!response.ok) throw new Error('Failed to fetch')
        
        const data = await response.json()
        if (data.cast && data.cast.author && data.cast.author.username && data.cast.author.display_name) {
          setCast(data.cast)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchCast()
  }, [initialCast, url, inView, cast])

  // Skeleton
  if (loading || !inView) {
    return (
      <div ref={ref} className={cn('p-3 rounded-lg border border-border/50 bg-muted/20', className)}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-muted/50 animate-pulse" />
          <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-muted/50 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  const hasValidAuthor = !!cast?.author && !!cast.author.username && !!cast.author.display_name

  // Error state
  if (error || !cast || !hasValidAuthor) {
    return (
      <div ref={ref} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 group', className)}>
        <span className="text-purple-500">◈</span>
        <span className="text-sm text-muted-foreground truncate">{url || 'Cast no disponible'}</span>
        {showRemove && onRemove && (
          <button
            onClick={onRemove}
            className="ml-auto p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
    )
  }

  // Primera imagen del cast
  const firstImage = cast.embeds?.find(
    e => e.url && e.type === 'image'
  )

  const author = cast.author

  return (
    <div 
      ref={ref}
      className={cn(
        'relative border border-border/50 rounded-lg p-3 bg-muted/20 hover:bg-muted/30 transition-colors group',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {author.pfp_url && (
          <img 
            src={author.pfp_url}
            alt={author.username}
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="font-medium text-sm">{author.display_name}</span>
        <span className="text-muted-foreground text-xs">@{author.username}</span>
      </div>

      {/* Text */}
      <p className="text-sm text-foreground/90 line-clamp-3">{cast.text}</p>

      {/* Image preview */}
      {firstImage?.url && (
        <div className="mt-2 rounded-lg overflow-hidden h-32 w-full">
          <img 
            src={firstImage.url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// Helper para detectar URLs de casts
export function isFarcasterCastUrl(url: string): boolean {
  return (
    (url.includes('warpcast.com/') || url.includes('farcaster.xyz/')) &&
    /\/0x[a-f0-9]+/i.test(url)
  )
}
