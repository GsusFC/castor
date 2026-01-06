/**
 * Media utilities for compose module
 * Handles file validation, type detection, and media state management
 */

import type { MediaFile } from '@/components/compose/types'
import {
  MEDIA_RULES,
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  isImageMimeType,
  isVideoMimeType,
  getMediaTypeFromMime,
  getMaxFileSize,
  formatFileSize,
} from './validation-rules'

// Re-export from validation-rules for convenience
export {
  MEDIA_RULES,
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  isImageMimeType,
  isVideoMimeType,
  getMediaTypeFromMime,
  getMaxFileSize,
  formatFileSize,
}

// =============================================================================
// FILE VALIDATION
// =============================================================================

export interface FileValidationResult {
  valid: boolean
  error?: string
  type?: 'image' | 'video'
}

/**
 * Validate a file for upload
 */
export function validateFile(file: File): FileValidationResult {
  // Check MIME type
  if (!isAllowedMimeType(file.type)) {
    return {
      valid: false,
      error: `File type not supported: ${file.type || 'unknown'}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    }
  }
  
  const mediaType = getMediaTypeFromMime(file.type)
  if (!mediaType) {
    return {
      valid: false,
      error: 'Could not determine file type',
    }
  }
  
  // Check file size
  const maxSize = getMaxFileSize(mediaType)
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)}. Max: ${formatFileSize(maxSize)}`,
      type: mediaType,
    }
  }
  
  return {
    valid: true,
    type: mediaType,
  }
}

/**
 * Validate multiple files
 */
export function validateFiles(files: File[]): {
  valid: File[]
  invalid: Array<{ file: File; error: string }>
} {
  const valid: File[] = []
  const invalid: Array<{ file: File; error: string }> = []
  
  for (const file of files) {
    const result = validateFile(file)
    if (result.valid) {
      valid.push(file)
    } else {
      invalid.push({ file, error: result.error || 'Unknown error' })
    }
  }
  
  return { valid, invalid }
}

// =============================================================================
// FILE TYPE DETECTION
// =============================================================================

/**
 * Get media type from file extension
 */
export function getTypeFromExtension(filename: string): 'image' | 'video' | null {
  const ext = filename.toLowerCase().split('.').pop()
  if (!ext) return null
  
  const withDot = `.${ext}`
  
  if ((MEDIA_RULES.imageExtensions as readonly string[]).includes(withDot)) {
    return 'image'
  }
  if ((MEDIA_RULES.videoExtensions as readonly string[]).includes(withDot)) {
    return 'video'
  }
  
  return null
}

/**
 * Get media type from URL
 */
export function getTypeFromUrl(url: string): 'image' | 'video' | null {
  try {
    const pathname = new URL(url).pathname
    return getTypeFromExtension(pathname)
  } catch {
    // Try as filename
    return getTypeFromExtension(url)
  }
}

/**
 * Check if URL is a media URL
 */
export function isMediaUrl(url: string): boolean {
  return getTypeFromUrl(url) !== null
}

/**
 * Check if URL is from known media providers
 */
export function isKnownMediaProvider(url: string): boolean {
  const providers = [
    'imagedelivery.net',     // Cloudflare Images
    'cloudflare',
    'livepeer',
    'lp-playback',
    'stream.cloudflare.com', // Cloudflare Stream
  ]
  
  return providers.some(p => url.includes(p))
}

// =============================================================================
// MEDIA STATE HELPERS
// =============================================================================

/**
 * Check if a MediaFile is ready for publishing
 */
export function isMediaReady(media: MediaFile): boolean {
  if (!media.url) return false
  if (media.uploading) return false
  if (media.error) return false
  if (media.type === 'video' && media.videoStatus === 'pending') return false
  if (media.type === 'video' && media.videoStatus === 'processing') return false
  return true
}

/**
 * Check if all media in array is ready
 */
export function isAllMediaReady(media: MediaFile[]): boolean {
  return media.every(isMediaReady)
}

/**
 * Get media that is still uploading
 */
export function getUploadingMedia(media: MediaFile[]): MediaFile[] {
  return media.filter(m => m.uploading)
}

/**
 * Get media with errors
 */
export function getErrorMedia(media: MediaFile[]): MediaFile[] {
  return media.filter(m => m.error)
}

/**
 * Get pending/processing videos
 */
export function getPendingVideos(media: MediaFile[]): MediaFile[] {
  return media.filter(m => 
    m.type === 'video' && 
    (m.videoStatus === 'pending' || m.videoStatus === 'processing')
  )
}

/**
 * Get status summary for media array
 */
export interface MediaStatusSummary {
  total: number
  ready: number
  uploading: number
  processing: number
  errors: number
  isAllReady: boolean
}

export function getMediaStatus(media: MediaFile[]): MediaStatusSummary {
  const uploading = media.filter(m => m.uploading).length
  const errors = media.filter(m => m.error).length
  const processing = media.filter(m => 
    m.type === 'video' && 
    (m.videoStatus === 'pending' || m.videoStatus === 'processing')
  ).length
  const ready = media.filter(isMediaReady).length
  
  return {
    total: media.length,
    ready,
    uploading,
    processing,
    errors,
    isAllReady: ready === media.length,
  }
}

// =============================================================================
// MEDIA CREATION HELPERS
// =============================================================================

/**
 * Create a MediaFile from a File object (before upload)
 */
export function createMediaFromFile(file: File): MediaFile {
  const type = getMediaTypeFromMime(file.type) || 'image'
  
  return {
    file,
    preview: URL.createObjectURL(file),
    type,
    uploading: true,
  }
}

/**
 * Create a MediaFile from a URL (after upload or external)
 */
export function createMediaFromUrl(
  url: string, 
  type?: 'image' | 'video',
  metadata?: Partial<MediaFile>
): MediaFile {
  return {
    preview: url,
    url,
    type: type || getTypeFromUrl(url) || 'image',
    uploading: false,
    ...metadata,
  }
}

/**
 * Update a MediaFile after successful upload
 */
export function updateMediaAfterUpload(
  media: MediaFile,
  uploadResult: {
    url: string
    cloudflareId?: string
    livepeerAssetId?: string
    livepeerPlaybackId?: string
    videoStatus?: MediaFile['videoStatus']
  }
): MediaFile {
  return {
    ...media,
    url: uploadResult.url,
    uploading: false,
    error: undefined,
    cloudflareId: uploadResult.cloudflareId,
    livepeerAssetId: uploadResult.livepeerAssetId,
    livepeerPlaybackId: uploadResult.livepeerPlaybackId,
    videoStatus: uploadResult.videoStatus,
  }
}

/**
 * Update a MediaFile after upload error
 */
export function updateMediaAfterError(media: MediaFile, error: string): MediaFile {
  return {
    ...media,
    uploading: false,
    error,
  }
}

// =============================================================================
// CLEANUP UTILITIES
// =============================================================================

/**
 * Revoke object URLs to free memory
 * Call this when removing media or unmounting component
 */
export function revokeMediaPreviews(media: MediaFile[]): void {
  for (const m of media) {
    if (m.preview && m.preview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(m.preview)
      } catch {
        // Ignore errors
      }
    }
  }
}

/**
 * Clean media array: remove failed uploads, revoke blob URLs
 */
export function cleanupMedia(media: MediaFile[]): MediaFile[] {
  const errors = getErrorMedia(media)
  revokeMediaPreviews(errors)
  
  return media.filter(m => !m.error)
}
