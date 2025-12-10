'use client'

import { useEffect, useRef, useState } from 'react'

const CYBERPUNK_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+'

interface ScrambleTextProps {
  text: string
  className?: string
  duration?: number
  speed?: number
}

export function ScrambleText({ 
  text, 
  className = '', 
  duration = 0.6, // segundos
  speed = 0.03 // velocidad de cada frame
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isAnimating, setIsAnimating] = useState(false)
  const previousTextRef = useRef(text)
  
  useEffect(() => {
    if (previousTextRef.current === text) return

    const startText = previousTextRef.current
    const endText = text
    const length = Math.max(startText.length, endText.length)
    
    setIsAnimating(true)
    previousTextRef.current = text
    
    let iteration = 0
    const totalIterations = duration / speed
    
    const interval = setInterval(() => {
      const progress = iteration / totalIterations
      
      const scrambled = endText
        .split('')
        .map((char, index) => {
          if (index < progress * endText.length) {
            return endText[index]
          }
          return CYBERPUNK_CHARS[Math.floor(Math.random() * CYBERPUNK_CHARS.length)]
        })
        .join('')
      
      setDisplayText(scrambled)
      
      if (iteration >= totalIterations) {
        clearInterval(interval)
        setDisplayText(endText)
        setIsAnimating(false)
      }
      
      iteration += 1
    }, speed * 1000)
    
    return () => clearInterval(interval)
  }, [text, duration, speed])

  return (
    <span className={className}>
      {displayText}
    </span>
  )
}
