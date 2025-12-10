'use client'

import { useState, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseRendererProps, RemovableProps } from '../types'

interface ImageRendererProps extends BaseRendererProps, RemovableProps {
  url: string
  alt?: string
  aspectRatio?: 'auto' | 'square' | 'video'
}

export function ImageRenderer({ 
  url, 
  alt = '', 
  className,
  aspectRatio = 'auto',
  onRemove,
  showRemove = false,
}: ImageRendererProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '200px',
  })

  const handleLoad = useCallback(() => setLoaded(true), [])
  const handleError = useCallback(() => setError(true), [])

  const aspectClass = {
    auto: 'aspect-auto max-h-96',
    square: 'aspect-square',
    video: 'aspect-video',
  }[aspectRatio]

  if (error) {
    return (
      <div className={cn('w-full h-48 bg-muted/50 rounded-lg flex items-center justify-center', className)}>
        <span className="text-sm text-muted-foreground">Error al cargar imagen</span>
      </div>
    )
  }

  return (
    <>
      <div ref={ref} className={cn('relative rounded-lg overflow-hidden group', className)}>
        {/* Skeleton */}
        {!loaded && (
          <div className="w-full h-48 bg-muted/50 animate-pulse rounded-lg" />
        )}

        {/* Image */}
        {inView && (
          <img
            src={url}
            alt={alt}
            className={cn(
              'w-full object-cover rounded-lg cursor-pointer transition-opacity',
              aspectClass,
              loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
            )}
            onLoad={handleLoad}
            onError={handleError}
            onClick={() => setIsFullscreen(true)}
            loading="lazy"
          />
        )}

        {/* Remove button */}
        {showRemove && onRemove && loaded && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold"
          >
            ✕
          </button>
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
