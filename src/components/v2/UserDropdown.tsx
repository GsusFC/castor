'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Users, LogOut, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

interface UserDropdownProps {
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

export function UserDropdown({ user, accounts = [] }: UserDropdownProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/'
    } catch {
      setIsLoggingOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          {user.pfpUrl ? (
            <img
              src={user.pfpUrl}
              alt={user.displayName || user.username}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {(user.displayName || user.username).charAt(0).toUpperCase()}
            </div>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{user.displayName || user.username}</p>
            {accounts.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">
                {accounts.map(a => `@${a.username}`).join(' · ')}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

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
  )
}
