'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  AuthKitProvider,
  SignInButton as FarcasterSignIn,
  useProfile,
  useSignInMessage,
} from '@farcaster/auth-kit'
import '@farcaster/auth-kit/styles.css'

export function SignInButton() {
  const config = useMemo(
    () => ({
      rpcUrl: 'https://mainnet.optimism.io',
      domain: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      siweUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    }),
    []
  )

  return (
    <AuthKitProvider config={config}>
      <SignInButtonInner />
    </AuthKitProvider>
  )
}

function SignInButtonInner() {
  const { isAuthenticated, profile } = useProfile()
  const { message, signature } = useSignInMessage()

  const handleAuth = useCallback(async () => {
    if (!isAuthenticated) return
    if (!profile?.fid) return
    if (!message) return
    if (!signature) return

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })

      if (res.ok) {
        window.location.href = '/'
      }
    } catch (err) {
      console.error('Auth error:', err)
    }
  }, [isAuthenticated, message, profile?.fid, signature])

  useEffect(() => {
    if (isAuthenticated && profile?.fid && message && signature) {
      handleAuth()
    }
  }, [handleAuth, isAuthenticated, message, profile?.fid, signature])

  return <FarcasterSignIn />
}
