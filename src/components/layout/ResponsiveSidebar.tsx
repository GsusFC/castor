'use client'

import dynamic from 'next/dynamic'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Dynamically import AppSidebar only on desktop
const AppSidebar = dynamic(
  () => import('./AppSidebar').then((mod) => ({ default: mod.AppSidebar })),
  {
    ssr: false,
    loading: () => null,
  }
)

/**
 * Responsive wrapper for AppSidebar
 * Only loads and renders the sidebar on desktop viewports (lg breakpoint)
 * This prevents mobile users from downloading unnecessary desktop navigation code
 */
export function ResponsiveSidebar() {
  const isDesktop = useMediaQuery('lg')

  // Only render on desktop
  if (!isDesktop) return null

  return <AppSidebar />
}
