'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

interface ForceThemeProps {
  theme: string
  children: React.ReactNode
}

export function ForceTheme({ theme, children }: ForceThemeProps) {
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    if (resolvedTheme !== theme) {
      setTheme(theme)
    }
  }, [theme, setTheme, resolvedTheme])

  return <>{children}</>
}
