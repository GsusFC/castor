'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

interface ThemeProviderProps {
  children: React.ReactNode
  forcedTheme?: string
  storageKey?: string
  defaultTheme?: string
}

export function ThemeProvider({ 
  children, 
  forcedTheme,
  storageKey = 'castor-theme',
  defaultTheme = 'dark'
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={false}
      forcedTheme={forcedTheme}
      storageKey={storageKey}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
