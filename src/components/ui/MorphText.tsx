'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface MorphTextProps {
  text: string
  className?: string
}

export function MorphText({ text, className }: MorphTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const previousTextRef = useRef(text)

  useEffect(() => {
    // Si el texto prop es igual al que tenemos guardado como "previo", no hacemos nada
    if (text === previousTextRef.current) return

    // Actualizamos la ref para el futuro
    previousTextRef.current = text

    // Iniciamos la transición
    setIsTransitioning(true)

    // A mitad de la animación (cuando está invisible/blur), cambiamos el texto
    const timer1 = setTimeout(() => {
      setDisplayText(text)
    }, 150)

    // Al final, quitamos el efecto blur
    const timer2 = setTimeout(() => {
      setIsTransitioning(false)
    }, 300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [text])

  return (
    <div 
      className={cn(
        "transition-all duration-300 ease-in-out will-change-[opacity,filter]",
        isTransitioning ? "opacity-0 blur-sm scale-[0.99]" : "opacity-100 blur-0 scale-100",
        className
      )}
    >
      {displayText}
    </div>
  )
}
