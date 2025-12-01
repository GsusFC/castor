'use client'

import { AuthKitProvider } from '@farcaster/auth-kit'
import '@farcaster/auth-kit/styles.css'
import { useState, useEffect } from 'react'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<{
    rpcUrl: string
    domain: string
    siweUri: string
  } | null>(null)

  useEffect(() => {
    // Solo configurar en el cliente
    setConfig({
      rpcUrl: 'https://mainnet.optimism.io',
      domain: window.location.host,
      siweUri: window.location.origin,
    })
  }, [])

  // Mientras no tengamos config, mostrar children sin AuthKit
  if (!config) {
    return <>{children}</>
  }

  return (
    <AuthKitProvider config={config}>
      {children}
    </AuthKitProvider>
  )
}
