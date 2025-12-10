'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { 
  Newspaper, 
  Calendar, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  Plus,
  Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'

const NAV_ITEMS = [
  { href: '/dashboard/feed', label: 'Feed', icon: Newspaper },
  { href: '/dashboard', label: 'Scheduled', icon: Calendar },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/accounts', label: 'Accounts', icon: Users },
]

// TODO: Estos canales deberían venir de la API/contexto
const MY_CHANNELS = [
  { id: 'dev', name: 'dev' },
  { id: 'design', name: 'design' },
  { id: 'farcaster', name: 'farcaster' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0 border-r border-border/50 bg-background/50 backdrop-blur-sm">
        {/* Logo */}
        <div className="p-6">
          <Link href="/dashboard/feed" className="flex items-center gap-2">
            <span className="text-2xl">🦫</span>
            <span className="font-semibold text-lg">Castor</span>
          </Link>
        </div>

        {/* New Cast Button */}
        <div className="px-4 mb-4">
          <Button 
            onClick={() => setComposeOpen(true)}
            className="w-full justify-center gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            New Cast
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/dashboard' 
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Channels Section */}
          <div className="mt-8">
            <h3 className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              My Channels
            </h3>
            <ul className="space-y-1">
              {MY_CHANNELS.map((channel) => (
                <li key={channel.id}>
                  <Link
                    href={`/dashboard/feed?channel=${channel.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Hash className="w-4 h-4" />
                    {channel.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Configuración"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <ComposeModal 
        open={composeOpen} 
        onOpenChange={setComposeOpen}
      />
    </>
  )
}
