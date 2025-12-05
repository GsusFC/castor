'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Plus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/accounts', icon: Users, label: 'Accounts' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)
  const { selectedAccountId } = useSelectedAccount()

  return (
    <>
      {/* Bottom navigation - only visible on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-20 sm:hidden safe-bottom">
        <div className="flex items-center justify-around h-16 px-2 safe-x">
          {/* Home */}
          <Link
            href="/dashboard"
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-lg transition-colors touch-target",
              pathname === '/dashboard'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          {/* New Cast - Central FAB style */}
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center justify-center w-14 h-14 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all touch-target active:scale-95"
            aria-label="New Cast"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Accounts */}
          <Link
            href="/dashboard/accounts"
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-lg transition-colors touch-target",
              pathname === '/dashboard/accounts' || pathname?.startsWith('/dashboard/accounts/')
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-medium">Accounts</span>
          </Link>
        </div>
      </nav>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAccountId={selectedAccountId}
      />
    </>
  )
}
