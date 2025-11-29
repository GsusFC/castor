'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'

export function AddAccountButton() {
  return (
    <Link
      href="/dashboard/accounts/connect"
      className="flex items-center gap-2 bg-castor-black hover:bg-castor-dark text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
    >
      <Plus className="w-5 h-5" />
      Añadir cuenta
    </Link>
  )
}
