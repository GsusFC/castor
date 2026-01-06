/**
 * Centralized validation rules for compose module
 * Single source of truth for all limits and allowed values
 */

// =============================================================================
// CHARACTER LIMITS
// =============================================================================

export const CHAR_LIMITS = {
  /** Standard Farcaster limit */
  standard: 1024,
  /** Pro/Premium account limit */
  pro: 10000,
  /** Minimum content length for a cast */
  min: 1,
} as const

// =============================================================================
// EMBED LIMITS
// =============================================================================

export const EMBED_LIMITS = {
  /** Standard account max embeds per cast */
  standard: 2,
  /** Pro account max embeds per cast */
  pro: 4,
} as const

// =============================================================================
// MEDIA RULES
// =============================================================================

export const MEDIA_RULES = {
  /** Allowed image MIME types */
  imageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  
  /** Allowed video MIME types */
  videoTypes: ['video/mp4', 'video/quicktime', 'video/webm'] as const,
  
  /** Max image file size in bytes (10MB) */
  maxImageSize: 10 * 1024 * 1024,
  
  /** Max video file size in bytes (100MB) */
  maxVideoSize: 100 * 1024 * 1024,
  
  /** Allowed image extensions */
  imageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const,
  
  /** Allowed video extensions */
  videoExtensions: ['.mp4', '.mov', '.webm'] as const,
} as const

/** All allowed MIME types */
export const ALLOWED_MIME_TYPES = [
  ...MEDIA_RULES.imageTypes,
  ...MEDIA_RULES.videoTypes,
] as const

/** All allowed extensions */
export const ALLOWED_EXTENSIONS = [
  ...MEDIA_RULES.imageExtensions,
  ...MEDIA_RULES.videoExtensions,
] as const

// =============================================================================
// URL RULES
// =============================================================================

export const URL_RULES = {
  /** URLs count as this many characters (like Twitter) */
  charLength: 23,
  
  /** Max URLs allowed per cast */
  maxPerCast: 2,
  
  /** Regex for URL detection */
  pattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi,
} as const

// =============================================================================
// MENTION RULES
// =============================================================================

export const MENTION_RULES = {
  /** Regex for mention detection (@username) */
  pattern: /@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*/g,
  
  /** Max mentions allowed per cast (soft limit, for UX) */
  maxPerCast: 10,
  
  /** Min username length */
  minLength: 1,
  
  /** Max username length */
  maxLength: 20,
} as const

// =============================================================================
// CHANNEL RULES
// =============================================================================

export const CHANNEL_RULES = {
  /** Regex for channel detection (/channel) */
  pattern: /\/[a-zA-Z0-9_-]+/g,
} as const

// =============================================================================
// THREAD RULES
// =============================================================================

export const THREAD_RULES = {
  /** Max casts in a thread */
  maxCasts: 25,
  
  /** Min casts for a thread (single cast is not a thread) */
  minCasts: 2,
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export type AccountTier = 'standard' | 'pro'

/**
 * Get max characters based on account tier
 */
export const getMaxChars = (isPro: boolean): number =>
  isPro ? CHAR_LIMITS.pro : CHAR_LIMITS.standard

/**
 * Get max embeds based on account tier
 */
export const getMaxEmbeds = (isPro: boolean): number =>
  isPro ? EMBED_LIMITS.pro : EMBED_LIMITS.standard

/**
 * Get max file size for a media type
 */
export const getMaxFileSize = (type: 'image' | 'video'): number =>
  type === 'video' ? MEDIA_RULES.maxVideoSize : MEDIA_RULES.maxImageSize

/**
 * Check if MIME type is allowed
 */
export const isAllowedMimeType = (mimeType: string): boolean =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)

/**
 * Check if MIME type is an image
 */
export const isImageMimeType = (mimeType: string): boolean =>
  (MEDIA_RULES.imageTypes as readonly string[]).includes(mimeType)

/**
 * Check if MIME type is a video
 */
export const isVideoMimeType = (mimeType: string): boolean =>
  (MEDIA_RULES.videoTypes as readonly string[]).includes(mimeType)

/**
 * Get media type from MIME type
 */
export const getMediaTypeFromMime = (mimeType: string): 'image' | 'video' | null => {
  if (isImageMimeType(mimeType)) return 'image'
  if (isVideoMimeType(mimeType)) return 'video'
  return null
}

/**
 * Format bytes to human readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
