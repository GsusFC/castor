'use client'

import { useCallback, useEffect } from 'react'
import { SignInButton as FarcasterSignIn, useProfile } from '@farcaster/auth-kit'

export function SignInButton() {
  const { isAuthenticated, profile } = useProfile()

  const handleAuth = useCallback(async () => {
    if (!profile?.fid) return

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: profile.fid }),
      })

      if (res.ok) {
        window.location.href = '/'
      }
    } catch (err) {
      console.error('Auth error:', err)
    }
  }, [profile])

  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      handleAuth()
    }
  }, [isAuthenticated, profile, handleAuth])

  return <FarcasterSignIn />
}
