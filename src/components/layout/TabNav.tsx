'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Rss, LayoutDashboard, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HEADER } from '@/lib/spacing-system'

interface TabNavItem {
  href: string
  label: string
  icon: React.ReactNode
  isActive: (pathname: string) => boolean
}

const tabs: TabNavItem[] = [
  {
    href: '/',
    label: 'Feed',
    icon: <Rss className="w-4 h-4" />,
    isActive: (pathname) => pathname === '/',
  },
  {
    href: '/studio',
    label: 'Studio',
    icon: <LayoutDashboard className="w-4 h-4" />,
    isActive: (pathname) => pathname === '/studio',
  },
  {
    href: '/accounts',
    label: 'Accounts',
    icon: <BarChart3 className="w-4 h-4" />,
    isActive: (pathname) => pathname.startsWith('/accounts'),
  },
]

export function TabNav() {
  const pathname = usePathname()

  return (
    <nav className={cn(
      "sticky z-30",
      HEADER.TABS.stickyTop,
      HEADER.TABS.bgClass,
      "border-b border-border/50"
    )}>
      <div className={cn(
        "max-w-[1440px] mx-auto",
        HEADER.TABS.padding,
        "flex items-center"
      )}>
        <div className={cn(
          "flex items-center rounded-full bg-muted/50 p-1",
          HEADER.TABS.gap
        )}>
          {tabs.map((tab) => {
            const isActive = tab.isActive(pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm border border-border/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
