'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { HLSVideo } from '@/components/ui/HLSVideo'

interface VideoModalProps {
  url: string
  poster?: string
  onClose: () => void
}

export function VideoModal({ url, poster, onClose }: VideoModalProps) {
  // Keyboard handler and body scroll lock
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reproductor de video"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-8 h-8" />
      </button>
      <div
        className="w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <HLSVideo
          src={url}
          poster={poster}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
