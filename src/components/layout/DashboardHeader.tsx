'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Plus, LayoutDashboard, Rss, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { GlobalSearch } from '@/components/feed/GlobalSearch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function DashboardHeader() {
  const [composeOpen, setComposeOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const router = useRouter()
  const pathname = usePathname()
  const { selectedAccountId } = useSelectedAccount()
  
  const isFeed = pathname === '/'

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
      // Force full page reload to clear all client state
      window.location.href = '/landing'
    } catch (err) {
      toast.error('Error signing out')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <header className={cn(
        "fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-b border-border z-20 safe-top transition-transform duration-300",
        !isVisible && "-translate-y-full"
      )}>
        <div className="h-14 sm:h-16 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between">
          {/* Logo + Nav */}
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 group min-h-[44px] touch-target"
            >
              <img 
                src="/brand/logo.png" 
                alt="Castor" 
                className="w-8 h-8 flex-shrink-0 group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Nav Tabs - hidden on mobile */}
            <nav className="hidden sm:flex items-center bg-muted/50 rounded-lg p-1">
              <Link
                href="/"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isFeed
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Rss className="w-4 h-4" />
                <span>Feed</span>
              </Link>
              <Link
                href="/studio"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  pathname === '/studio'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Studio</span>
              </Link>
              <Link
                href="/analytics"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  pathname === '/analytics'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </Link>
            </nav>
          </div>

          {/* Search - hidden on mobile */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <GlobalSearch 
              onSelectUser={(user) => router.push(`/user/${user.username}`)}
              onSelectChannel={(channel) => router.push(`/?channel=${channel.id}`)}
              onSelectCast={(cast) => {
                // Abrir cast en nueva pestaña
                const url = `https://farcaster.xyz/~/conversations/${cast.hash}`
                window.open(url, '_blank')
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* New Cast button - hidden on mobile */}
            <Button 
              onClick={() => setComposeOpen(true)} 
              size="sm" 
              className="hidden sm:flex gap-2 h-9 px-3"
            >
              <Plus className="w-4 h-4" />
              <span>New Cast</span>
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

      <ComposeModal 
        open={composeOpen} 
        onOpenChange={setComposeOpen} 
        defaultAccountId={selectedAccountId}
      />
    </>
  )
}
