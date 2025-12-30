'use client'

import { useRef, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageLightboxProps {
  urls: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export function ImageLightbox({ urls, index, onClose, onPrev, onNext }: ImageLightboxProps) {
  const didSwipeRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Keyboard navigation and body scroll lock
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev()
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [onClose, onPrev, onNext])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (urls.length <= 1) return
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragDeltaRef.current = { x: 0, y: 0 }
    didSwipeRef.current = false
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start) return
    dragDeltaRef.current = { x: e.clientX - start.x, y: e.clientY - start.y }
  }

  const handlePointerEnd = () => {
    const start = dragStartRef.current
    if (!start) return

    const { x: deltaX, y: deltaY } = dragDeltaRef.current
    dragStartRef.current = null
    dragDeltaRef.current = { x: 0, y: 0 }

    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX > 50 && absX > absY) {
      didSwipeRef.current = true
      if (deltaX > 0) onPrev()
      else onNext()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imágenes"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={() => {
        if (didSwipeRef.current) {
          didSwipeRef.current = false
          return
        }
        onClose()
      }}
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

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Imagen anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Imagen siguiente"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-medium bg-black/30 px-2 py-1 rounded">
          {index + 1} / {urls.length}
        </div>
      )}

      <img
        src={urls[index]}
        alt=""
        className="max-w-full max-h-full object-contain touch-none select-none"
        draggable={false}
        onPointerDown={(e) => {
          e.stopPropagation()
          handlePointerDown(e)
        }}
        onPointerMove={(e) => {
          e.stopPropagation()
          handlePointerMove(e)
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          handlePointerEnd()
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          handlePointerEnd()
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (didSwipeRef.current) {
            didSwipeRef.current = false
          }
        }}
      />
    </div>
  )
}
