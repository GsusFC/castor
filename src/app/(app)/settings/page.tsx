'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Settings, Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { AI_LANGUAGE_OPTIONS } from '@/lib/ai/languages'
import { useAiLanguagePreferences } from '@/context/AiLanguagePreferencesContext'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)
  const { defaultLanguage, enabledLanguages, setDefaultLanguage, toggleEnabledLanguage } =
    useAiLanguagePreferences()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const currentTheme = isMounted ? theme : null

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Customize your experience</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 space-y-6">
        {/* Theme Section */}
        <section className="p-4 rounded-xl border border-border/50 bg-card/50">
          <h2 className="text-sm font-medium mb-4">Appearance</h2>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                currentTheme === 'light'
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <Sun className="w-6 h-6" />
              <span className="text-sm">Light</span>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                currentTheme === 'dark'
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <Moon className="w-6 h-6" />
              <span className="text-sm">Dark</span>
            </button>

            <button
              onClick={() => setTheme('system')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                currentTheme === 'system'
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <Monitor className="w-6 h-6" />
              <span className="text-sm">System</span>
            </button>
          </div>
        </section>

        <section className="p-4 rounded-xl border border-border/50 bg-card/50">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-medium">AI Language</h2>
              <p className="text-sm text-muted-foreground">
                Set the default output language and which languages are available for generation/translation.
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  Default: {AI_LANGUAGE_OPTIONS.find((l) => l.value === defaultLanguage)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {AI_LANGUAGE_OPTIONS.map((lang) => (
                  <DropdownMenuItem key={lang.value} onClick={() => setDefaultLanguage(lang.value)}>
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AI_LANGUAGE_OPTIONS.map((lang) => {
              const isEnabled = enabledLanguages.includes(lang.value)
              const isDefault = lang.value === defaultLanguage

              return (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => toggleEnabledLanguage(lang.value)}
                  disabled={isDefault}
                  aria-pressed={isEnabled}
                  className={cn(
                    'flex flex-col items-start gap-1 p-4 rounded-lg border transition-colors text-left',
                    isEnabled ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border',
                    isDefault && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  <span className="text-sm font-medium">{lang.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {isDefault ? 'Default' : isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Future sections placeholder */}
        <section className="p-4 rounded-xl border border-border/50 bg-card/50 opacity-50">
          <h2 className="text-sm font-medium mb-2">More settings coming soon</h2>
          <p className="text-sm text-muted-foreground">
            Notifications, language, keyboard shortcuts...
          </p>
        </section>
      </div>
    </div>
  )
}
