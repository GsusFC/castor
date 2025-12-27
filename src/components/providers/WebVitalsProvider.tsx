'use client'

import { useEffect } from 'react'

export function WebVitalsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    void (async () => {
      const { initWebVitals } = await import('@/lib/web-vitals')
      initWebVitals()
    })()
  }, [])

  return <>{children}</>
}
