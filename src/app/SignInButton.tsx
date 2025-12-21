'use client'

import { useCallback, useEffect } from 'react'
import { SignInButton as FarcasterSignIn, useProfile, useSignInMessage } from '@farcaster/auth-kit'

export function SignInButton() {
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
