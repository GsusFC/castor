'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { GlobalSearch } from '@/components/feed/GlobalSearch'
import { TabNav } from './TabNav'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HEADER } from '@/lib/spacing-system'

export function DashboardHeader() {
  const [composeOpen, setComposeOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const router = useRouter()
  const { selectedAccountId } = useSelectedAccount()

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current
      const scrollingUp = currentScrollY < lastScrollY.current

      // Only hide after scrolling past 100px
      if (currentScrollY > 100 && scrollingDown) {
        setIsVisible(false)
      } else if (scrollingUp) {
        setIsVisible(true)
      }

      // Always show at top
      if (currentScrollY < 50) {
        setIsVisible(true)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error('Error signing out')
      window.location.href = '/landing'
    } catch (err) {
      toast.error('Error signing out')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      {/* Primary Navigation Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-40 safe-top transition-transform duration-300",
        HEADER.PRIMARY.bgClass,
        !isVisible && "-translate-y-full"
      )}>
        <div className={cn(
          "h-14 sm:h-16 max-w-[1440px] mx-auto flex items-center justify-between",
          HEADER.PRIMARY.padding
        )}>
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="flex items-center h-10 w-10 rounded-lg hover:bg-muted transition-colors group min-h-[44px] touch-target"
            >
              <img
                src="/brand/logo.png"
                alt="Castor"
                className="w-8 h-8 flex-shrink-0 group-hover:scale-110 transition-transform"
              />
            </Link>
          </div>

          {/* Search - grows on md+, hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-sm mx-4">
            <GlobalSearch
              onSelectUser={(user) => router.push(`/user/${user.username}`)}
              onSelectChannel={(channel) => router.push(`/?channel=${channel.id}`)}
              onSelectCast={(cast) => router.push(`/cast/${cast.hash}`)}
            />
          </div>

          {/* Spacer for centering on md+ */}
          <div className="hidden md:flex flex-1" />

          {/* Actions - better spacing */}
          <div className={cn("flex items-center", HEADER.PRIMARY.gap)}>
            {/* New Cast button - hidden on mobile */}
            <Button
              onClick={() => setComposeOpen(true)}
              size="sm"
              className="hidden sm:flex gap-2 h-9 px-3"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </Button>
            <ThemeToggle collapsed />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Secondary Navigation - Tab Nav (Sticky) */}
      <div className="pt-14 sm:pt-16">
        <TabNav />
      </div>

      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAccountId={selectedAccountId}
      />
    </>
  )
}
