'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  collapsed?: boolean
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Evitar hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size={collapsed ? 'icon' : 'default'}
        className="w-full justify-start gap-3 px-3 py-2 text-muted-foreground"
        disabled
      >
        <Sun className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span>Theme</span>}
      </Button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <Button
      variant="ghost"
      size={collapsed ? 'icon' : 'default'}
      onClick={handleToggle}
      className={`w-full gap-3 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent ${
        collapsed ? 'justify-center' : 'justify-start'
      }`}
      title={collapsed ? (isDark ? 'Light mode' : 'Dark mode') : undefined}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Moon className="w-4 h-4 flex-shrink-0" />
      )}
      {!collapsed && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </Button>
  )
}
