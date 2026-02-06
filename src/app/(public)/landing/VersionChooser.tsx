'use client'

import { useRouter } from 'next/navigation'
import { LayoutDashboard, PenLine, Sparkles } from 'lucide-react'

const COOKIE_NAME = 'castor_studio_version'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function setCookie(value: 'v1' | 'v2') {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

export function VersionChooser() {
  const router = useRouter()

  const handleChoose = (version: 'v1' | 'v2') => {
    setCookie(version)
    router.push(version === 'v2' ? '/v2/studio' : '/studio')
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mx-auto">
      {/* Studio v1 */}
      <button
        onClick={() => handleChoose('v1')}
        className="group flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-foreground/30 hover:bg-muted/50 transition-all duration-200 text-left cursor-pointer"
      >
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
          <LayoutDashboard className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h2 className="font-display text-base text-card-foreground mb-0.5">Studio v1</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Classic dashboard with feed, sidebar and modal composer.
          </p>
        </div>
      </button>

      {/* Studio v2 */}
      <button
        onClick={() => handleChoose('v2')}
        className="group relative flex flex-col items-start gap-3 p-5 rounded-xl border border-primary/40 bg-primary/[0.03] hover:border-primary/60 hover:bg-primary/[0.06] transition-all duration-200 text-left cursor-pointer"
      >
        {/* New badge */}
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-semibold text-primary uppercase tracking-wider">
          <Sparkles className="w-2.5 h-2.5" />
          New
        </span>

        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <PenLine className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-base text-card-foreground mb-0.5">Studio v2</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Composer-first workspace with calendar alongside.
          </p>
        </div>
      </button>
    </div>
  )
}
