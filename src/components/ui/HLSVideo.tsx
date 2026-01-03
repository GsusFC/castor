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
    if (!video) return
    setError(false)
    
    // Validar que src existe y es una URL válida
    if (!src || src.trim() === '') {
      setError(true)
      return
    }

    const isHLS = src.includes('.m3u8')

    let didCancel = false
    let cleanupNativeErrorListener: (() => void) | null = null

    const setupNative = () => {
      video.src = src

      const handleError = () => {
        if (!didCancel) setError(true)
      }
      video.addEventListener('error', handleError)
      cleanupNativeErrorListener = () => video.removeEventListener('error', handleError)
    }

    if (!isHLS) {
      setupNative()
      return () => {
        didCancel = true
        cleanupNativeErrorListener?.()
      }
    }

    import('hls.js')
      .then(({ default: Hls }) => {
        if (didCancel) return

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          })
          hlsRef.current = hls
          hls.loadSource(src)
          hls.attachMedia(video)
          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (!data.fatal) return
            console.warn('[HLS] Fatal error:', data.type, data.details, data.reason || '')
            setError(true)
          })
          return
        }

        if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
          setupNative()
          return
        }

        setError(true)
      })
      .catch(() => {
        if (!didCancel) setError(true)
      })

    return () => {
      didCancel = true
      cleanupNativeErrorListener?.()
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
