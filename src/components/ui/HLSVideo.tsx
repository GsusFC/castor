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
      setError(true)
      return
    }

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
              console.warn('[HLS] Fatal error:', data.type, data.details, data.reason || '')
              setError(true)
            }
          })
        } else {
          setError(true)
        }
      }).catch(() => {
        setError(true)
      })
    } else {
      // Safari o video no-HLS: usar src directamente
      video.src = src

      // Manejar errores de carga del video
      const handleError = () => setError(true)
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
