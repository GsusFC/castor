'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignInButton, useProfile } from '@farcaster/auth-kit'
import { Loader2, Calendar, Users, ShieldCheck, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, profile } = useProfile()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = useCallback(async () => {
    if (!profile?.fid) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: profile.fid }),
      })

      if (!res.ok) {
        throw new Error('Verification failed')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
    }
  }, [profile, router])

  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      handleSuccess()
    }
  }, [isAuthenticated, profile, handleSuccess])

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-purple-100 flex flex-col relative overflow-hidden">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">
        
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {/* Logo */}
          <div className="flex justify-center mb-2">
            <img 
              src="/brand/logo.png" 
              alt="Castor" 
              className="w-20 h-20 md:w-24 md:h-24"
            />
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-castor-brand/10 border border-castor-brand/20 text-xs font-medium text-castor-brand">
            <Sparkles className="w-3 h-3" />
            <span>Castor Beta</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display tracking-tight text-gray-900 leading-[1.1]">
            Smart scheduling for <span className="text-castor-brand">Farcaster</span>
          </h1>
          
          <p className="text-xl text-gray-500 md:w-3/4 mx-auto leading-relaxed">
            The ultimate tool for studios and creators. Manage multiple accounts, schedule threads and collaborate with your team.
          </p>

          <div className="pt-4 flex flex-col items-center gap-4">
            {isLoading ? (
              <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Signing in...</span>
              </div>
            ) : (
              <div className="scale-110 transition-transform hover:scale-115">
                <SignInButton />
              </div>
            )}
            
            {error && (
              <p className="text-red-500 text-sm font-medium bg-red-50 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Bento Grid Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <Card className="p-6 bg-white/50 backdrop-blur-sm border-gray-200 hover:border-castor-brand/50 transition-colors group">
            <div className="w-10 h-10 bg-castor-brand/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-castor-brand/20 transition-colors">
              <Calendar className="w-5 h-5 text-castor-brand" />
            </div>
            <h3 className="font-display text-gray-900 mb-2">Advanced Scheduling</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Schedule individual casts or complete threads with full control over dates and times.
            </p>
          </Card>

          <Card className="p-6 bg-white/50 backdrop-blur-sm border-gray-200 hover:border-castor-brand/50 transition-colors group">
            <div className="w-10 h-10 bg-castor-brand/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-castor-brand/20 transition-colors">
              <Users className="w-5 h-5 text-castor-brand" />
            </div>
            <h3 className="font-display text-gray-900 mb-2">Multi-Account</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Manage personal and brand accounts from a single unified dashboard.
            </p>
          </Card>

          <Card className="p-6 bg-white/50 backdrop-blur-sm border-gray-200 hover:border-castor-brand/50 transition-colors group">
            <div className="w-10 h-10 bg-castor-brand/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-castor-brand/20 transition-colors">
              <ShieldCheck className="w-5 h-5 text-castor-brand" />
            </div>
            <h3 className="font-display text-gray-900 mb-2">Secure Collaboration</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Share account access without sharing private keys. Built-in team roles.
            </p>
          </Card>
        </div>

        <footer className="mt-16 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Castor. Crafted together with FLOC*</p>
        </footer>
      </main>
    </div>
  )
}
