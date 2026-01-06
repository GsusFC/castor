'use client'

import { useState, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateSrcSet, SIZES_FULL_WIDTH } from '@/lib/image-utils'
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
        {/* Skeleton - maintains aspect ratio to prevent layout shift */}
        {!loaded && (
          <div className={cn('w-full bg-muted/50 animate-pulse rounded-lg', aspectClass, aspectRatio === 'auto' && 'h-48')} />
        )}

        {/* Image - with responsive srcset for optimal loading */}
        {inView && (
          <img
            src={url}
            srcSet={generateSrcSet(url)}
            sizes={SIZES_FULL_WIDTH}
            alt={alt}
            width={aspectRatio === 'auto' ? 640 : undefined}
            height={aspectRatio === 'auto' ? 384 : undefined}
            className={cn(
              'w-full object-cover rounded-lg cursor-pointer transition-opacity',
              aspectClass,
              loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
            )}
            onLoad={handleLoad}
            onError={handleError}
            onClick={() => setIsFullscreen(true)}
            loading="lazy"
            decoding="async"
          />
        )}

        {/* Remove button */}
        {showRemove && onRemove && loaded && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Eliminar"
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
            aria-label="Cerrar"
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
