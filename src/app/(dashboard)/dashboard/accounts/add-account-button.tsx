'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface AddAccountButtonProps {
  variant?: 'default' | 'icon'
}

export function AddAccountButton({ variant = 'default' }: AddAccountButtonProps) {
  if (variant === 'icon') {
    return (
      <Link 
        href="/dashboard/accounts/connect"
        className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted transition-all touch-target"
        title="Añadir cuenta"
      >
        <Plus className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
      </Link>
    )
  }

  return (
    <Button asChild>
      <Link href="/dashboard/accounts/connect">
        <Plus className="w-4 h-4 mr-2" />
        Añadir cuenta
      </Link>
    </Button>
  )
}
