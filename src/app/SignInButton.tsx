'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SignInButton as FarcasterSignIn, useProfile } from '@farcaster/auth-kit'

export function SignInButton() {
  const router = useRouter()
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
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Auth error:', err)
    }
  }, [profile, router])

  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      handleAuth()
    }
  }, [isAuthenticated, profile, handleAuth])

  return <FarcasterSignIn />
}
