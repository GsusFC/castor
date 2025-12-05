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
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-muted transition-all"
        title="Añadir cuenta"
      >
        <Plus className="w-4 h-4 text-muted-foreground" />
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
