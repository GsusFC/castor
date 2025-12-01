'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function AddAccountButton() {
  return (
    <Button asChild>
      <Link href="/dashboard/accounts/connect">
        <Plus className="w-4 h-4 mr-2" />
        Añadir cuenta
      </Link>
    </Button>
  )
}
