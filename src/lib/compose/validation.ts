/**
 * Validation utilities for compose module
 */

import type { CastItem } from '@/components/compose/types'

/**
 * Check if any media in the casts is still uploading or has errors
 */
export function hasMediaIssues(casts: CastItem[]): boolean {
  return casts.some((c) =>
    c.media.some((m) => m.uploading || m.error)
  )
}

/**
 * Check if any media in the casts has pending video processing
 */
export function hasPendingVideos(casts: CastItem[]): boolean {
  return casts.some((c) =>
    c.media.some((m) => m.type === 'video' && m.videoStatus === 'pending')
  )
}

/**
 * Check if media is ready for publishing
 * Returns error message if not ready, null if ready
 */
export function validateMediaReady(casts: CastItem[]): string | null {
  if (hasMediaIssues(casts)) {
    return 'Please wait for uploads to finish or remove failed files'
  }
  return null
}

/**
 * Check if casts have any content
 */
export function hasContent(casts: CastItem[]): boolean {
  return casts.some((cast) => cast.content.trim().length > 0)
}

/**
 * Check if any cast can be published (has content or embeds)
 */
export function canPublish(casts: CastItem[]): boolean {
  return casts.some((cast) => {
    const hasText = cast.content.trim().length > 0
    const hasMedia = cast.media.some((m) => m.url)
    const hasLinks = cast.links.length > 0
    return hasText || hasMedia || hasLinks
  })
}
