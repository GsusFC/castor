'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  AuthKitProvider,
  SignInButton as FarcasterSignIn,
  useSignInMessage,
} from '@farcaster/auth-kit'
import '@farcaster/auth-kit/styles.css'

export function SignInButton() {
  const config = useMemo(
    () => ({
      rpcUrl: 'https://mainnet.optimism.io',
      domain: typeof window !== 'undefined' ? window.location.host : 'localhost:3001',
      siweUri: typeof window !== 'undefined' ? window.location.href : 'http://localhost:3001/landing',
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
  const { message, signature } = useSignInMessage()

  const handleAuth = useCallback(async () => {
    if (!message) {
      return
    }
    if (!signature) {
      return
    }

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })

      if (res.ok) {
        // Always return to landing so authenticated users can choose v1 or v2 explicitly.
        window.location.href = '/landing'
      } else {
        console.error(`[SignInButton] Verify failed: status=${res.status}`)
      }
    } catch (err) {
      console.error('[SignInButton] Auth error:', err)
    }
  }, [message, signature])

  useEffect(() => {
    if (message && signature) {
      handleAuth()
    }
  }, [handleAuth, message, signature])

  return <FarcasterSignIn />
}
