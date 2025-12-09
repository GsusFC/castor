'use client'

import { useEffect, useRef, useState } from 'react'

interface HLSVideoProps {
  src: string
  className?: string
  poster?: string
}

export function HLSVideo({ src, className, poster }: HLSVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const hlsRef = useRef<any>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const isHLS = src.includes('.m3u8')

    // Si es HLS y el navegador no lo soporta nativamente, usar hls.js
    if (isHLS && !video.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          })
          hlsRef.current = hls
          hls.loadSource(src)
          hls.attachMedia(video)
          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
              console.error('[HLS] Fatal error:', data)
              setError(true)
            }
          })
        } else {
          console.error('[HLS] Not supported')
          setError(true)
        }
      }).catch((err) => {
        console.error('[HLS] Failed to load hls.js:', err)
        setError(true)
      })
    } else {
      // Safari o video no-HLS: usar src directamente
      video.src = src
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground text-xs ${className}`}>
        Error cargando video
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      playsInline
      preload="metadata"
      poster={poster}
    />
  )
}
