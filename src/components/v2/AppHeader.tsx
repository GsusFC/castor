'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserDropdown } from './UserDropdown'
import { useNotifications } from '@/context/NotificationsContext'
import { useSearch } from '@/context/SearchContext'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  user: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
  accounts?: Array<{
    id: string
    username: string
    pfpUrl: string | null
  }>
}

const NAV_ITEMS = [
  { label: 'Studio', href: '/v2/studio' },
  { label: 'Feed', href: '/v2/feed' },
] as const

export function AppHeader({ user, accounts }: AppHeaderProps) {
  const pathname = usePathname()
  const notifications = useNotifications()
  const search = useSearch()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center px-4 lg:px-6 gap-6">
        {/* Logo — click to go back to version chooser */}
        <button
          type="button"
          aria-label="Open version chooser"
          onClick={() => {
            document.cookie = 'castor_studio_version=; path=/; max-age=0'
            window.location.href = '/landing'
          }}
          className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/brand/logo.png"
            alt="Castor"
            width={28}
            height={28}
            className="w-7 h-7"
          />
          <span className="font-display text-lg font-semibold tracking-tight hidden sm:inline">
            Castor
          </span>
        </button>

        {/* Nav Tabs */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search trigger — ⌘K */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-2.5"
          onClick={() => search.open()}
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Search...</span>
          <kbd className="ml-1 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-80">
            ⌘K
          </kbd>
        </Button>
        {/* Mobile search icon */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Open search"
          onClick={() => search.open()}
        >
          <Search className="w-4.5 h-4.5" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Toggle notifications"
          onClick={() => notifications.toggle()}
        >
          <Bell className="w-4.5 h-4.5" />
          {notifications.unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
            </span>
          )}
        </Button>

        {/* User Dropdown */}
        <UserDropdown user={user} accounts={accounts} />
      </div>
    </header>
  )
}
