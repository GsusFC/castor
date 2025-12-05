'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoValidationProps {
  url?: string
  videoStatus?: 'pending' | 'processing' | 'ready' | 'error'
  cloudflareId?: string
  className?: string
}

interface ValidationResult {
  isValid: boolean
  status: 'checking' | 'valid' | 'invalid' | 'processing'
  message: string
  details?: {
    contentType?: string
    size?: number
    accessible?: boolean
  }
}

export function VideoValidation({ 
  url, 
  videoStatus, 
  cloudflareId,
  className 
}: VideoValidationProps) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    status: 'checking',
    message: 'Verificando...'
  })

  useEffect(() => {
    if (!url) {
      setValidation({
        isValid: false,
        status: 'invalid',
        message: 'Sin URL'
      })
      return
    }

    // Si el video está procesándose en Cloudflare, hacer polling
    if ((videoStatus === 'pending' || videoStatus === 'processing') && cloudflareId) {
      setValidation({
        isValid: false,
        status: 'processing',
        message: 'Procesando video...'
      })
      
      // Polling cada 5 segundos para verificar si el video está listo
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/media/status?cloudflareId=${cloudflareId}`)
          const data = await res.json()
          
          if (data.data?.isReady || data.isReady) {
            clearInterval(pollInterval)
            setValidation({
              isValid: true,
              status: 'valid',
              message: 'Video Cloudflare listo',
            })
          } else if (data.data?.status === 'error' || data.status === 'error') {
            clearInterval(pollInterval)
            setValidation({
              isValid: false,
              status: 'invalid',
              message: 'Error en procesamiento'
            })
          }
        } catch (err) {
          console.error('[VideoValidation] Polling error:', err)
        }
      }, 5000)
      
      return () => clearInterval(pollInterval)
    }

    if (videoStatus === 'error') {
      setValidation({
        isValid: false,
        status: 'invalid',
        message: 'Error en procesamiento'
      })
      return
    }

    // Verificar si es una URL válida para Warpcast
    validateVideoUrl(url)
  }, [url, videoStatus, cloudflareId])

  async function validateVideoUrl(videoUrl: string) {
    setValidation({
      isValid: false,
      status: 'checking',
      message: 'Verificando compatibilidad...'
    })

    // URLs de Cloudflare Stream son válidas
    const isCloudflareUrl = videoUrl.includes('cloudflarestream.com') || 
      videoUrl.includes('cloudflare')
    
    if (isCloudflareUrl) {
      setValidation({
        isValid: true,
        status: 'valid',
        message: 'Video Cloudflare listo',
      })
      return
    }

    try {
      // Verificar que la URL sea accesible y tenga el content-type correcto
      const response = await fetch('/api/media/validate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      })

      const data = await response.json()

      if (data.isValid) {
        setValidation({
          isValid: true,
          status: 'valid',
          message: 'Compatible con Warpcast',
          details: data.details
        })
      } else {
        setValidation({
          isValid: false,
          status: 'invalid',
          message: data.error || 'No compatible',
          details: data.details
        })
      }
    } catch {
      // Si falla la validación, asumimos que está bien si es MP4
      const isLikelyValid = videoUrl.includes('.mp4') || 
        videoUrl.includes('download.mp4') ||
        videoUrl.includes('vod-cdn.lp-playback')
      
      setValidation({
        isValid: isLikelyValid,
        status: isLikelyValid ? 'valid' : 'invalid',
        message: isLikelyValid ? 'Formato MP4 detectado' : 'No se pudo verificar'
      })
    }
  }

  const statusConfig = {
    checking: {
      icon: Loader2,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      animate: true
    },
    processing: {
      icon: Loader2,
      color: 'text-blue-500 dark:text-blue-400',
      bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
      animate: true
    },
    valid: {
      icon: CheckCircle,
      color: 'text-green-500 dark:text-green-400',
      bgColor: 'bg-green-500/10 dark:bg-green-500/20',
      animate: false
    },
    invalid: {
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      animate: false
    }
  }

  const config = statusConfig[validation.status]
  const Icon = config.icon

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      config.bgColor,
      config.color,
      className
    )}>
      <Icon className={cn("w-3.5 h-3.5", config.animate && "animate-spin")} />
      <span className="truncate max-w-[120px]">{validation.message}</span>
    </div>
  )
}
