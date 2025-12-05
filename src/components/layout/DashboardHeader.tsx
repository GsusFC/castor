'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { toast } from 'sonner'

export function DashboardHeader() {
  const [composeOpen, setComposeOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()
  const { selectedAccountId } = useSelectedAccount()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error('Error signing out')
      // Force full page reload to clear all client state
      window.location.href = '/'
    } catch (err) {
      toast.error('Error signing out')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border z-20">
        <div className="h-full max-w-6xl mx-auto px-6 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <img 
              src="/brand/logo.png" 
              alt="Castor" 
              className="w-8 h-8 flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <span className="font-display text-lg text-foreground hidden sm:block">Castor</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button onClick={() => setComposeOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Cast</span>
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
