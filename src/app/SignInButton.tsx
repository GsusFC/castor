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

  // Debug logging
  useEffect(() => {
    console.log('[SignInButton] Auth state changed:', {
      isAuthenticated,
      hasFid: !!profile?.fid,
      fid: profile?.fid,
      hasMessage: !!message,
      hasSignature: !!signature,
    })
  }, [isAuthenticated, profile?.fid, message, signature])

  const handleAuth = useCallback(async () => {
    console.log('[SignInButton] handleAuth called with:', {
      isAuthenticated,
      fid: profile?.fid,
      hasMessage: !!message,
      hasSignature: !!signature,
    })

    if (!isAuthenticated) {
      console.log('[SignInButton] Not authenticated, aborting')
      return
    }
    if (!profile?.fid) {
      console.log('[SignInButton] No FID, aborting')
      return
    }
    if (!message) {
      console.log('[SignInButton] No message, aborting')
      return
    }
    if (!signature) {
      console.log('[SignInButton] No signature, aborting')
      return
    }

    console.log('[SignInButton] All checks passed, calling /api/auth/verify')

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })

      console.log('[SignInButton] Verify response:', {
        ok: res.ok,
        status: res.status,
      })

      if (res.ok) {
        console.log('[SignInButton] Auth successful, redirecting to /')
        window.location.href = '/'
      } else {
        const data = await res.json()
        console.error('[SignInButton] Verify failed:', data)
      }
    } catch (err) {
      console.error('[SignInButton] Auth error:', err)
    }
  }, [isAuthenticated, message, profile?.fid, signature])

  useEffect(() => {
    console.log('[SignInButton] useEffect triggered, checking conditions...')
    if (isAuthenticated && profile?.fid && message && signature) {
      console.log('[SignInButton] All conditions met, calling handleAuth')
      handleAuth()
    } else {
      console.log('[SignInButton] Conditions NOT met:', {
        isAuthenticated,
        hasFid: !!profile?.fid,
        hasMessage: !!message,
        hasSignature: !!signature,
      })
    }
  }, [handleAuth, isAuthenticated, message, profile?.fid, signature])

  return <FarcasterSignIn />
}
