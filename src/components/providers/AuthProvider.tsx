'use client'

import { AuthKitProvider } from '@farcaster/auth-kit'
import '@farcaster/auth-kit/styles.css'
import { useState, useEffect } from 'react'

const RPC_URL = 'https://mainnet.optimism.io'
const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const getDomainFromUrl = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return 'localhost'
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<{
    rpcUrl: string
    domain: string
    siweUri: string
  }>(() => ({
    rpcUrl: RPC_URL,
    domain: getDomainFromUrl(DEFAULT_APP_URL),
    siweUri: DEFAULT_APP_URL,
  }))

  useEffect(() => {
    setConfig({
      rpcUrl: RPC_URL,
      domain: window.location.hostname,
      siweUri: window.location.origin,
    })
  }, [])

  return <AuthKitProvider config={config}>{children}</AuthKitProvider>
}
