'use client'

import { useState, useEffect } from 'react'

/**
 * Tailwind breakpoints matching the default theme
 * These constants ensure consistency across the codebase
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/**
 * Hook for responsive media queries with hydration safety
 *
 * @param breakpoint - Tailwind breakpoint name (sm, md, lg, xl, 2xl)
 * @returns boolean indicating if viewport is >= breakpoint width
 *
 * @example
 * ```tsx
 * const isMobile = !useMediaQuery('sm')  // < 640px
 * const isDesktop = useMediaQuery('lg')   // >= 1024px
 * const isTablet = useMediaQuery('md') && !useMediaQuery('lg')
 * ```
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
    const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`
    const mql = window.matchMedia(query)

    // Set initial value
    setMatches(mql.matches)

    // Handler for changes
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Modern browsers
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }

    // Fallback for older browsers
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [breakpoint])

  // Prevent hydration mismatch by returning false until client-side
  return isHydrated ? matches : false
}

/**
 * Hook for checking if viewport is below a breakpoint
 * Convenience wrapper around useMediaQuery
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQueryBelow('lg')  // < 1024px
 * ```
 */
export function useMediaQueryBelow(breakpoint: Breakpoint): boolean {
  const isAbove = useMediaQuery(breakpoint)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated ? !isAbove : false
}

/**
 * Hook for checking if viewport is between two breakpoints
 *
 * @example
 * ```tsx
 * const isTablet = useMediaQueryBetween('md', 'lg')  // 768px - 1023px
 * ```
 */
export function useMediaQueryBetween(min: Breakpoint, max: Breakpoint): boolean {
  const isAboveMin = useMediaQuery(min)
  const isAboveMax = useMediaQuery(max)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated ? isAboveMin && !isAboveMax : false
}
