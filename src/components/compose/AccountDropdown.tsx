'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Account } from './types'

interface AccountDropdownProps {
  accounts: Account[]
  selectedAccount: Account | undefined
  onSelect: (id: string) => void
  isLoading: boolean
}

export function AccountDropdown({
  accounts,
  selectedAccount,
  onSelect,
  isLoading,
}: AccountDropdownProps) {
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8" aria-label="Cargando cuentas">
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    )
  }

  if (accounts.length === 0) {
    return (
      <Button variant="outline" size="sm" className="h-8 text-muted-foreground">
        Sin cuentas
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-2"
          aria-label={`Cuenta seleccionada: ${selectedAccount?.username || 'ninguna'}`}
        >
          {selectedAccount?.pfpUrl ? (
            <img 
              src={selectedAccount.pfpUrl} 
              alt="" 
              className="w-5 h-5 rounded-full object-cover" 
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-muted" />
          )}
          <span className="max-w-[100px] truncate">
            @{selectedAccount?.username || 'Cuenta'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => {
              onSelect(account.id)
              setOpen(false)
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              selectedAccount?.id === account.id && "bg-muted"
            )}
          >
            {account.pfpUrl ? (
              <img 
                src={account.pfpUrl} 
                alt="" 
                className="w-6 h-6 rounded-full object-cover" 
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-muted" />
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium truncate">
                {account.displayName || account.username}
              </p>
              <p className="text-xs text-muted-foreground">@{account.username}</p>
            </div>
            {account.isPremium && (
              <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">
                Pro
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
