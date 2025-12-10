'use client'

import { useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseRendererProps, RemovableProps } from '../types'

interface YouTubeRendererProps extends BaseRendererProps, RemovableProps {
  videoId: string
}

export function YouTubeRenderer({ 
  videoId, 
  className,
  onRemove,
  showRemove = false,
}: YouTubeRendererProps) {
  const [showPlayer, setShowPlayer] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '200px',
  })

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  if (!inView) {
    return <div ref={ref} className={cn('w-full aspect-video bg-muted/50 rounded-lg animate-pulse', className)} />
  }

  if (showPlayer) {
    return (
      <div ref={ref} className={cn('relative w-full aspect-video rounded-lg overflow-hidden group', className)}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
        />
        {showRemove && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div 
      ref={ref}
      className={cn('relative w-full aspect-video rounded-lg overflow-hidden cursor-pointer group', className)}
      onClick={() => setShowPlayer(true)}
    >
      <img
        src={thumbnailError ? fallbackThumbnail : thumbnailUrl}
        alt="YouTube video"
        className="w-full h-full object-cover"
        onError={() => setThumbnailError(true)}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
        <div className="w-16 h-12 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center shadow-lg">
          <Play className="w-7 h-7 text-white ml-1 fill-white" />
        </div>
      </div>

      {/* YouTube branding */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        YouTube
      </div>

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// Helper para extraer video ID
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}
