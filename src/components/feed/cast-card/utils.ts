import { NEXT_IMAGE_ALLOWED_HOSTNAMES } from './constants'

/**
 * Check if URL is allowed for Next.js Image optimization
 */
export const isNextImageAllowedSrc = (src: string): boolean => {
  try {
    const hostname = new URL(src).hostname
    if (NEXT_IMAGE_ALLOWED_HOSTNAMES.has(hostname)) return true
    if (hostname.endsWith('.googleusercontent.com')) return true
    return false
  } catch {
    return false
  }
}

/**
 * Convert timestamp to short time ago format
 */
export const getShortTimeAgo = (timestamp: string): string => {
  const now = Date.now()
  const date = new Date(timestamp)
  const seconds = Math.floor((now - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return date.toLocaleDateString()
}

/**
 * Read FID list from localStorage
 */
export const readFidListFromStorage = (key: string): number[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f === 'number') : []
  } catch {
    return []
  }
}

/**
 * Write FID list to localStorage
 */
export const writeFidListToStorage = (key: string, fids: number[]): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(fids))
    window.dispatchEvent(new CustomEvent('castor:moderation-updated'))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}
