'use client'

import { useTheme } from 'next-themes'
import { Settings, Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-2xl mx-auto -mt-4 sm:-mt-6 md:-mt-8">
      {/* Header */}
      <div className="sticky top-0 z-40 pt-4 sm:pt-6 pb-4 bg-background/80 backdrop-blur-lg border-b border-border/50 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Configuración</h1>
            <p className="text-sm text-muted-foreground">Personaliza tu experiencia</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 space-y-6">
        {/* Theme Section */}
        <section className="p-4 rounded-xl border border-border/50 bg-card/50">
          <h2 className="text-sm font-medium mb-4">Apariencia</h2>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                theme === 'light' 
                  ? "border-primary bg-primary/5" 
                  : "border-border/50 hover:border-border"
              )}
            >
              <Sun className="w-6 h-6" />
              <span className="text-sm">Claro</span>
            </button>
            
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? "border-primary bg-primary/5" 
                  : "border-border/50 hover:border-border"
              )}
            >
              <Moon className="w-6 h-6" />
              <span className="text-sm">Oscuro</span>
            </button>
            
            <button
              onClick={() => setTheme('system')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                theme === 'system' 
                  ? "border-primary bg-primary/5" 
                  : "border-border/50 hover:border-border"
              )}
            >
              <Monitor className="w-6 h-6" />
              <span className="text-sm">Sistema</span>
            </button>
          </div>
        </section>

        {/* Future sections placeholder */}
        <section className="p-4 rounded-xl border border-border/50 bg-card/50 opacity-50">
          <h2 className="text-sm font-medium mb-2">Más opciones próximamente</h2>
          <p className="text-sm text-muted-foreground">
            Notificaciones, idioma, atajos de teclado...
          </p>
        </section>
      </div>
    </div>
  )
}
