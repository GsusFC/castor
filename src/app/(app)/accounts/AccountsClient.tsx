'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConnectAccountModal } from '@/components/accounts/ConnectAccountModal'

export function AccountsClient() {
  const router = useRouter()
  const [connectOpen, setConnectOpen] = useState(false)

  // Abrir modal si viene con ?connect=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connect') === 'true') {
      setConnectOpen(true)
      // Limpiar el query param
      router.replace('/accounts', { scroll: false })
    }
  }, [router])

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
