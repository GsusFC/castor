'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useNotifications } from '@/context/NotificationsContext'
import {
  Newspaper,
  Calendar,
  BarChart3,
  Users,
  Bell,
  Settings,
  LogOut,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'

const NAV_ITEMS: Array<{ href: string; label: string; icon: any; showUnreadBadge?: boolean }> = [
  { href: '/', label: 'Feed', icon: Newspaper },
  { href: '/notifications', label: 'Notifications', icon: Bell, showUnreadBadge: true },
  { href: '/studio', label: 'Studio', icon: Calendar },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/accounts', label: 'Accounts', icon: Users },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)
  const { unreadCount, open: openNotifications, isOpen: isNotificationsOpen } = useNotifications()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0 border-r border-border/50 bg-background/50 backdrop-blur-sm">
        {/* Logo */}
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <img src="/brand/logo.png" alt="Castor" className="w-8 h-8" />
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
              const isNotifications = item.href === '/notifications'

              const isRouteActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

              const isActive = isNotifications ? isNotificationsOpen || isRouteActive : isRouteActive

              return (
                <li key={item.href}>
                  {isNotifications ? (
                    <button
                      type="button"
                      onClick={openNotifications}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                      aria-label="Open notifications"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="flex-1">{item.label}</span>
                      {item.showUnreadBadge && unreadCount > 0 && (
                        <span
                          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                          aria-label={`${unreadCount} unread notifications`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                      aria-label={item.showUnreadBadge ? 'Open notifications' : item.label}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="flex-1">{item.label}</span>
                      {item.showUnreadBadge && unreadCount > 0 && (
                        <span
                          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                          aria-label={`${unreadCount} unread notifications`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>


        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Log out"
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
