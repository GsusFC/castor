'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
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
      if (!res.ok) throw new Error('Error al cerrar sesión')
      router.push('/login')
    } catch (err) {
      toast.error('Error al cerrar sesión')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 z-20">
        <div className="h-full max-w-6xl mx-auto px-6 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <img 
              src="/brand/logo.png" 
              alt="Castor" 
              className="w-8 h-8 flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <span className="font-display text-lg text-gray-900 hidden sm:block">Castor</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button onClick={() => setComposeOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Cast</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-gray-500 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              aria-label="Cerrar sesión"
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
