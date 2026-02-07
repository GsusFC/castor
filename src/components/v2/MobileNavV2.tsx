'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LayoutDashboard, Rss, PenSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const ComposeModal = dynamic(
  () => import('@/components/compose/ComposeModal').then(mod => ({ default: mod.ComposeModal })),
  { ssr: false }
)

const NAV_ITEMS = [
  { id: 'studio', label: 'Studio', icon: LayoutDashboard, href: '/v2/studio' },
  { id: 'feed', label: 'Feed', icon: Rss, href: '/v2/feed' },
  { id: 'compose', label: 'Cast', icon: PenSquare, href: '' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/v2/settings' },
] as const

export function MobileNavV2() {
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden pb-safe">
        <div className="flex items-center justify-around h-14 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isCompose = item.id === 'compose'
            const isActive = !isCompose && pathname.startsWith(item.href)

            if (isCompose) {
              return (
                <button
                  key={item.id}
                  onClick={() => setComposeOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 w-14 -mt-3"
                >
                  <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                    <Icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="text-[10px] font-medium text-primary">{item.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 w-14 py-1 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
      />
    </>
  )
}
