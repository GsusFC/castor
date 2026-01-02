'use client'

import { useEffect, useRef, useState } from 'react'
import { useMediaQueryBelow } from '@/hooks/useMediaQuery'

interface HLSVideoProps {
  src: string
  className?: string
  poster?: string
  lazyInit?: boolean
}

export function HLSVideo({ src, className, poster, lazyInit = false }: HLSVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(!lazyInit)
  const hlsRef = useRef<any>(null)
  const isMobile = useMediaQueryBelow('lg')

  // Intersection Observer para lazy init
  useEffect(() => {
    if (!lazyInit) return

    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [lazyInit])

  useEffect(() => {
    if (!isVisible) return

    const video = videoRef.current
    if (!video) return

    // Validar que src existe y es una URL válida
    if (!src || src.trim() === '') {
      console.error('[HLSVideo] Empty src provided:', { src, lazyInit, isVisible })
      setError(true)
      return
    }

    const isHLS = src.includes('.m3u8')
    // Detect iOS Safari where native HLS works perfectly
    const isIOSSafari = typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream

    console.log('[HLSVideo] Attempting to load:', {
      src,
      isHLS,
      isIOSSafari,
      lazyInit
    })

    // Strategy: Prefer hls.js on desktop, use native only on iOS Safari
    if (isHLS && !isIOSSafari) {
      // For HLS on desktop/Android, prefer hls.js (more reliable)
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          console.log('[HLSVideo] Using hls.js (desktop/Android)')
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          })
          hlsRef.current = hls
          hls.loadSource(src)
          hls.attachMedia(video)
          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
              console.error('[HLS] Fatal error:', { type: data.type, details: data.details, reason: data.reason, url: src })
              setError(true)
            }
          })
        } else {
          // Fallback to native if hls.js isn't supported
          console.log('[HLSVideo] hls.js not supported, falling back to native')
          video.src = src

          const handleError = (e: Event) => {
            const videoEl = e.target as HTMLVideoElement
            console.error('[HLSVideo] Native fallback error:', {
              src,
              error: videoEl.error,
              code: videoEl.error?.code,
            })
            setError(true)
          }
          video.addEventListener('error', handleError)
        }
      }).catch((err) => {
        console.error('[HLSVideo] Failed to import hls.js:', err)
        // Fallback to native
        video.src = src
      })
    } else {
      // iOS Safari or non-HLS: use native playback
      console.log('[HLSVideo] Using native video playback:', { isHLS, isIOSSafari })
      video.src = src

      // Manejar errores de carga del video
      const handleError = (e: Event) => {
        const videoEl = e.target as HTMLVideoElement
        console.error('[HLSVideo] Native video error:', {
          src,
          error: videoEl.error,
          code: videoEl.error?.code,
          message: videoEl.error?.message,
          networkState: videoEl.networkState,
          readyState: videoEl.readyState,
        })
        setError(true)
      }
      video.addEventListener('error', handleError)

      return () => video.removeEventListener('error', handleError)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, isVisible])

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
      preload={isMobile ? 'none' : 'metadata'}
      poster={poster}
    />
  )
}
