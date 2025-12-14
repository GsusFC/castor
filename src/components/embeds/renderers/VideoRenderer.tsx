'use client'

import { useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseRendererProps, RemovableProps } from '../types'

interface VideoRendererProps extends BaseRendererProps, RemovableProps {
  url: string
}

export function VideoRenderer({ 
  url, 
  className,
  onRemove,
  showRemove = false,
}: VideoRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showControls, setShowControls] = useState(false)
  const [error, setError] = useState(false)

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '200px',
  })

  const isHLS = url.includes('.m3u8') || url.includes('stream.warpcast.com')

  const handlePlay = () => {
    setShowControls(true)
    videoRef.current?.play()
  }

  if (error) {
    return (
      <div className={cn('w-full h-48 bg-muted/50 rounded-lg flex items-center justify-center', className)}>
        <span className="text-sm text-muted-foreground">Error al cargar video</span>
      </div>
    )
  }

  return (
    <div ref={ref} className={cn('relative rounded-lg overflow-hidden group', className)}>
      {!inView ? (
        <div className="w-full aspect-video bg-muted/50 animate-pulse rounded-lg" />
      ) : isHLS || showControls ? (
        <video
          ref={videoRef}
          src={url}
          controls
          autoPlay={showControls}
          preload="metadata"
          className="w-full max-h-96 rounded-lg"
          onError={() => setError(true)}
        />
      ) : (
        <div className="relative cursor-pointer" onClick={handlePlay}>
          <video
            ref={videoRef}
            src={url}
            preload="metadata"
            className="w-full max-h-96 rounded-lg"
            onError={() => setError(true)}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition rounded-lg">
            <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-black ml-1" />
            </div>
          </div>
        </div>
      )}

      {/* Remove button */}
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
