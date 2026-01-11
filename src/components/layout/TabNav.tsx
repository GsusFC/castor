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
        HEADER.TABS.containerPadding,
        HEADER.TABS.container,
        "flex items-center justify-center"
      )}>
        <div className={cn(
          "flex items-center",
          HEADER.TABS.containerBg,
          HEADER.TABS.containerPadding,
          HEADER.TABS.gap
        )}>
          {tabs.map((tab) => {
            const isActive = tab.isActive(pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center",
                  HEADER.TABS.iconText,
                  HEADER.TABS.pill.base,
                  isActive
                    ? HEADER.TABS.pill.active
                    : HEADER.TABS.pill.inactive
                )}
              >
                <span className={HEADER.TABS.iconSize}>
                  {tab.icon}
                </span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
