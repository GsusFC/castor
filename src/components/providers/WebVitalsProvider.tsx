'use client'

import { useEffect } from 'react'
import { initWebVitals } from '@/lib/web-vitals'

export function WebVitalsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      initWebVitals()
    }
  }, [])

  return <>{children}</>
}
