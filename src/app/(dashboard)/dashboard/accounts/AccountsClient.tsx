'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ConnectAccountModal } from '@/components/accounts/ConnectAccountModal'

export function AccountsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [connectOpen, setConnectOpen] = useState(false)

  // Abrir modal si viene con ?connect=true
  useEffect(() => {
    if (searchParams.get('connect') === 'true') {
      setConnectOpen(true)
      // Limpiar el query param
      router.replace('/dashboard/accounts', { scroll: false })
    }
  }, [searchParams, router])

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <ConnectAccountModal 
      open={connectOpen} 
      onOpenChange={setConnectOpen} 
      onSuccess={handleSuccess} 
    />
  )
}
