'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LayoutDashboard, Rss, Plus, Search, Settings, Users, LogOut, ChevronDown } from 'lucide-react'
import { useSearch } from '@/context/SearchContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const ComposeModal = dynamic(
  () => import('@/components/compose/ComposeModal').then(mod => ({ default: mod.ComposeModal })),
  { ssr: false }
)

const NAV_ITEMS = [
  { id: 'studio', label: 'Studio', icon: LayoutDashboard, href: '/v2/studio' },
  { id: 'feed', label: 'Feed', icon: Rss, href: '/v2/feed' },
] as const

type MePayload = {
  fid?: number
  username?: string
  displayName?: string
  pfpUrl?: string
}

const OPEN_COMPOSE_ON_DATE_EVENT = 'castor:studio-open-compose-on-date'

export function MobileNavV2() {
  const pathname = usePathname()
  const router = useRouter()
  const search = useSearch()

  const [composeOpen, setComposeOpen] = useState(false)
  const [composeDefaultDate, setComposeDefaultDate] = useState<string | undefined>(undefined)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [me, setMe] = useState<MePayload | null>(null)

  useEffect(() => {
    let mounted = true

    const loadMe = async () => {
      try {
        const meRes = await fetch('/api/me')
        if (!meRes.ok) return
        const meData = await meRes.json()
        if (!mounted) return

        const base: MePayload = {
          fid: meData?.fid,
          username: meData?.username,
          displayName: meData?.displayName,
          pfpUrl: meData?.pfpUrl,
        }

        if (typeof meData?.fid === 'number' && !base.pfpUrl) {
          const profileRes = await fetch(`/api/users/${meData.fid}`)
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            const user = profileData?.user || profileData
            if (mounted) {
              setMe({
                ...base,
                username: base.username || user?.username,
                displayName: base.displayName || user?.display_name || user?.displayName,
                pfpUrl: user?.pfp_url || user?.pfpUrl || null,
              })
            }
            return
          }
        }

        setMe(base)
      } catch {
        // Non-blocking: avatar menu still works with fallback initial.
      }
    }

    loadMe()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const handleOpenComposeOnDate = (event: Event) => {
      const customEvent = event as CustomEvent<{ date?: string }>
      const rawDate = customEvent.detail?.date
      if (!rawDate) return
      setComposeDefaultDate(rawDate)
      setComposeOpen(true)
    }

    window.addEventListener(OPEN_COMPOSE_ON_DATE_EVENT, handleOpenComposeOnDate as EventListener)
    return () => {
      window.removeEventListener(OPEN_COMPOSE_ON_DATE_EVENT, handleOpenComposeOnDate as EventListener)
    }
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/'
    } catch {
      setIsLoggingOut(false)
    }
  }

  const initials = (me?.displayName || me?.username || 'U').charAt(0).toUpperCase()

  return (
    <>
      {/* Floating quick actions */}
      <div className="fixed bottom-[4.75rem] left-4 right-4 z-50 lg:hidden pointer-events-none">
        <button
          type="button"
          onClick={() => search.open()}
          className="pointer-events-auto absolute left-0 bottom-0 w-11 h-11 rounded-full border border-border bg-background/95 backdrop-blur-md shadow-sm flex items-center justify-center text-foreground"
          aria-label="Open search"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setComposeDefaultDate(undefined)
            setComposeOpen(true)
          }}
          className="pointer-events-auto absolute right-0 bottom-0 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center"
          aria-label="Create cast"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-16 py-1 rounded-lg transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            )
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-16 py-1 rounded-lg transition-colors',
                  pathname.startsWith('/v2/settings') || pathname.startsWith('/v2/accounts')
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
                aria-label="Open account menu"
              >
                {me?.pfpUrl ? (
                  <img
                    src={me.pfpUrl}
                    alt={me.displayName || me.username || 'You'}
                    className="w-6 h-6 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold">
                    {initials}
                  </div>
                )}
                <span className="text-[11px] font-medium inline-flex items-center gap-1">
                  You
                  <ChevronDown className="w-3 h-3" />
                </span>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" side="top" className="w-52 mb-2">
              <DropdownMenuItem onClick={() => router.push('/v2/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configuration
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => router.push('/v2/accounts')}>
                <Users className="w-4 h-4 mr-2" />
                Manage accounts
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <ComposeModal
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open)
          if (!open) {
            setComposeDefaultDate(undefined)
          }
        }}
        defaultScheduleDate={composeDefaultDate}
      />
    </>
  )
}
