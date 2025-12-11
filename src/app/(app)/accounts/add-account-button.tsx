'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConnectAccountModal } from '@/components/accounts/ConnectAccountModal'

interface AddAccountButtonProps {
  variant?: 'default' | 'icon'
}

export function AddAccountButton({ variant = 'default' }: AddAccountButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = () => {
    router.refresh()
  }

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted transition-all touch-target"
          title="Añadir cuenta"
        >
          <Plus className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
        </button>
        <ConnectAccountModal open={open} onOpenChange={setOpen} onSuccess={handleSuccess} />
      </>
    )
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        Añadir cuenta
      </Button>
      <ConnectAccountModal open={open} onOpenChange={setOpen} onSuccess={handleSuccess} />
    </>
  )
}
