'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { Loader2, Calendar, Users, ShieldCheck, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'
 

 const SIWN_SUCCESS_EVENT = 'castor:siwn-success'

declare global {
  interface Window {
    onSignInSuccess?: (data: unknown) => void
  }
}

 if (typeof window !== 'undefined' && !window.onSignInSuccess) {
   window.onSignInSuccess = (payload: unknown) => {
     window.dispatchEvent(new CustomEvent(SIWN_SUCCESS_EVENT, { detail: payload }))
   }
 }

export default function HomePage() {
  const router = useRouter()
  const clientId = process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleSiwnSuccess = async (event: Event) => {
      try {
        setIsLoading(true)
        setError(null)

        const data = (event as CustomEvent).detail as any

        if (data?.statusCode && data?.statusCode !== 200) {
          const code = data?.errorResponse?.code
          const message = code ? `SIWN error: ${code}` : 'SIWN error'
          throw new Error(message)
        }

        const signerUuid = data?.signer_uuid
        const fid = data?.fid

        if (!signerUuid || !fid) {
          throw new Error('Invalid SIWN response')
        }

        const res = await fetch('/api/auth/siwn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signerUuid, fid }),
        })

        const json = await res.json().catch(() => null)

        if (!res.ok) {
          const details = json?.error || json?.message
          throw new Error(details || 'Authentication failed')
        }

        if (json?.success === false) {
          throw new Error(json?.error || 'Authentication failed')
        }

        router.push('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setIsLoading(false)
      }
    }

    window.addEventListener(SIWN_SUCCESS_EVENT, handleSiwnSuccess)

    if (!clientId) {
      setError('Missing NEXT_PUBLIC_NEYNAR_CLIENT_ID')
    }

    return () => {
      window.removeEventListener(SIWN_SUCCESS_EVENT, handleSiwnSuccess)
    }
  }, [clientId, router])

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 flex flex-col relative overflow-hidden">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

      <Script id="castor-siwn-success-callback" strategy="beforeInteractive">
        {`window.onSignInSuccess = function(payload) { window.dispatchEvent(new CustomEvent('${SIWN_SUCCESS_EVENT}', { detail: payload })); };`}
      </Script>

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">
        
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {/* Logo */}
          <div className="flex justify-center mb-2">
            <Image
              src="/brand/logo.png"
              alt="Castor"
              width={96}
              height={96}
              className="w-20 h-20 md:w-24 md:h-24"
              priority
            />
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            <Sparkles className="w-3 h-3" />
            <span>Castor Beta</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display tracking-tight text-foreground leading-[1.1]">
            Smart scheduling for <span className="text-primary">Farcaster</span>
          </h1>
          
          <p className="text-xl text-muted-foreground md:w-3/4 mx-auto leading-relaxed">
            The ultimate tool for studios and creators. Manage multiple accounts, schedule threads and collaborate with your team.
          </p>

          <div className="pt-4 flex flex-col items-center gap-4">
            {isLoading ? (
              <div className="flex items-center gap-2 px-6 py-3 bg-muted rounded-xl border border-border text-muted-foreground animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Signing in...</span>
              </div>
            ) : (
              <div className="scale-110 transition-transform hover:scale-115">
                {clientId && (
                  <>
                    <div
                      className="neynar_signin"
                      data-client_id={clientId}
                      data-success-callback="onSignInSuccess"
                    />
                    <Script
                      src="https://neynarxyz.github.io/siwn/raw/1.2.0/index.js"
                      strategy="afterInteractive"
                    />
                  </>
                )}
              </div>
            )}
            
            {error && (
              <p className="text-destructive text-sm font-medium bg-destructive/10 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Bento Grid Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors group">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-card-foreground mb-2">Advanced Scheduling</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Schedule individual casts or complete threads with full control over dates and times.
            </p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors group">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-card-foreground mb-2">Multi-Account</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage personal and brand accounts from a single unified dashboard.
            </p>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-colors group">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display text-card-foreground mb-2">Secure Collaboration</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Share account access without sharing private keys. Built-in team roles.
            </p>
          </Card>
        </div>

        <footer className="mt-16 flex flex-col items-center gap-4 text-sm text-muted-foreground">
          <ThemeToggle />
          <p>© {new Date().getFullYear()} Castor. Crafted together with FLOC*</p>
        </footer>
      </main>
    </div>
  )
}
