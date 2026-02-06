import Image from 'next/image'
import { cookies } from 'next/headers'
import { Calendar, Users, ShieldCheck, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { SignInButton } from '@/app/SignInButton'
import { getSession } from '@/lib/auth'
import { VersionChooser } from './VersionChooser'

export default async function HomePage() {
  const session = await getSession()
  const cookieStore = await cookies()
  const versionPref = cookieStore.get('castor_studio_version')?.value

  // Authenticated user without version preference → show version chooser
  const showChooser = !!session && !versionPref

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 flex flex-col relative overflow-hidden">
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">

        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16 max-w-2xl">
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

          {/* Auth action area: sign-in button or version chooser */}
          {showChooser ? (
            <div className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Welcome back, <span className="font-medium text-foreground">{session.displayName || session.username}</span>! Choose your workspace:
              </p>
              <VersionChooser />
            </div>
          ) : (
            <div className="pt-4">
              <div className="scale-110 transition-transform hover:scale-115">
                <SignInButton />
              </div>
            </div>
          )}
          <div className="pt-4 flex flex-col items-center gap-6">
            <div className="scale-110 transition-transform hover:scale-115">
              <SignInButton />
            </div>

            {/* Version Selector */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="/studio"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Studio v1
              </a>
              <a
                href="/v2/studio"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/50 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Try Studio v2
              </a>
            </div>
          </div>
        </div>

        {/* Bento Grid Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
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
