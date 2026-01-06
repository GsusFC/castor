/**
 * Serialization utilities for drafts and threads
 * Handles conversion between editor state and storage/API formats
 */

import type { CastItem, MediaFile, LinkEmbed } from '@/components/compose/types'
import { nanoid } from 'nanoid'

// =============================================================================
// SERIALIZED TYPES (for storage/API)
// =============================================================================

/**
 * Serialized media for storage
 * Excludes File objects and uploading state
 */
export interface SerializedMedia {
  url: string
  type: 'image' | 'video'
  preview?: string
  cloudflareId?: string
  livepeerAssetId?: string
  livepeerPlaybackId?: string
  videoStatus?: 'pending' | 'processing' | 'ready' | 'error'
  width?: number
  height?: number
}

/**
 * Serialized link embed for storage
 */
export interface SerializedLink {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
  isFrame?: boolean
  frameVersion?: string
  frameImage?: string
  frameButtons?: string[]
  framePostUrl?: string
}

/**
 * Serialized cast for storage
 */
export interface SerializedCast {
  id: string
  content: string
  media: SerializedMedia[]
  links: SerializedLink[]
}

/**
 * Draft metadata
 */
export interface DraftMetadata {
  id: string
  accountId: string
  channelId?: string | null
  scheduledAt?: string | null
  createdAt: string
  updatedAt: string
  replyToHash?: string | null
  quoteHash?: string | null
}

/**
 * Complete serialized draft
 */
export interface SerializedDraft {
  version: number
  metadata: DraftMetadata
  casts: SerializedCast[]
}

/**
 * Serialized thread for API submission
 */
export interface SerializedThread {
  casts: Array<{
    content: string
    embeds: Array<{
      url: string
      type?: 'image' | 'video'
      cloudflareId?: string
      livepeerAssetId?: string
      livepeerPlaybackId?: string
      videoStatus?: string
    }>
  }>
}

// Current serialization version
const SERIALIZATION_VERSION = 1

// =============================================================================
// SERIALIZATION (Editor -> Storage)
// =============================================================================

/**
 * Serialize a MediaFile for storage
 * Strips File object and uploading state
 */
export function serializeMedia(media: MediaFile): SerializedMedia | null {
  // Don't serialize media without URL (still uploading or failed)
  if (!media.url) return null
  
  return {
    url: media.url,
    type: media.type,
    preview: media.preview,
    cloudflareId: media.cloudflareId,
    livepeerAssetId: media.livepeerAssetId,
    livepeerPlaybackId: media.livepeerPlaybackId,
    videoStatus: media.videoStatus,
    width: media.width,
    height: media.height,
  }
}

/**
 * Serialize a LinkEmbed for storage
 * Strips loading state
 */
export function serializeLink(link: LinkEmbed): SerializedLink {
  return {
    url: link.url,
    title: link.title,
    description: link.description,
    image: link.image,
    siteName: link.siteName,
    favicon: link.favicon,
    isFrame: link.isFrame,
    frameVersion: link.frameVersion,
    frameImage: link.frameImage,
    frameButtons: link.frameButtons,
    framePostUrl: link.framePostUrl,
  }
}

/**
 * Serialize a CastItem for storage
 */
export function serializeCast(cast: CastItem): SerializedCast {
  return {
    id: cast.id,
    content: cast.content,
    media: cast.media
      .map(serializeMedia)
      .filter((m): m is SerializedMedia => m !== null),
    links: cast.links.map(serializeLink),
  }
}

/**
 * Serialize multiple casts as a draft
 */
export function serializeDraft(
  casts: CastItem[],
  metadata: Omit<DraftMetadata, 'createdAt' | 'updatedAt'>
): SerializedDraft {
  const now = new Date().toISOString()
  
  return {
    version: SERIALIZATION_VERSION,
    metadata: {
      ...metadata,
      createdAt: now,
      updatedAt: now,
    },
    casts: casts.map(serializeCast),
  }
}

/**
 * Serialize casts for thread API submission
 */
export function serializeForApi(
  casts: CastItem[],
  options: { includeMetadata?: boolean } = {}
): SerializedThread {
  const { includeMetadata = true } = options
  
  return {
    casts: casts.map(cast => ({
      content: cast.content,
      embeds: [
        // Media embeds
        ...cast.media
          .filter(m => m.url)
          .map(m => {
            if (includeMetadata) {
              return {
                url: m.url!,
                type: m.type,
                cloudflareId: m.cloudflareId,
                livepeerAssetId: m.livepeerAssetId,
                livepeerPlaybackId: m.livepeerPlaybackId,
                videoStatus: m.videoStatus,
              }
            }
            return { url: m.url! }
          }),
        // Link embeds
        ...cast.links.map(l => ({ url: l.url })),
      ],
    })),
  }
}

// =============================================================================
// DESERIALIZATION (Storage -> Editor)
// =============================================================================

/**
 * Deserialize media back to MediaFile
 */
export function deserializeMedia(media: SerializedMedia): MediaFile {
  return {
    preview: media.preview || media.url,
    url: media.url,
    type: media.type,
    uploading: false,
    cloudflareId: media.cloudflareId,
    livepeerAssetId: media.livepeerAssetId,
    livepeerPlaybackId: media.livepeerPlaybackId,
    videoStatus: media.videoStatus,
    width: media.width,
    height: media.height,
  }
}

/**
 * Deserialize link back to LinkEmbed
 */
export function deserializeLink(link: SerializedLink): LinkEmbed {
  return {
    url: link.url,
    title: link.title,
    description: link.description,
    image: link.image,
    siteName: link.siteName,
    favicon: link.favicon,
    loading: false,
    error: false,
    isFrame: link.isFrame,
    frameVersion: link.frameVersion,
    frameImage: link.frameImage,
    frameButtons: link.frameButtons,
    framePostUrl: link.framePostUrl,
  }
}

/**
 * Deserialize a cast back to CastItem
 */
export function deserializeCast(cast: SerializedCast): CastItem {
  return {
    id: cast.id,
    content: cast.content,
    media: cast.media.map(deserializeMedia),
    links: cast.links.map(deserializeLink),
  }
}

/**
 * Deserialize a complete draft
 */
export function deserializeDraft(draft: SerializedDraft): {
  casts: CastItem[]
  metadata: DraftMetadata
} {
  // Handle version migrations here if needed in the future
  if (draft.version !== SERIALIZATION_VERSION) {
    console.warn(`Draft version mismatch: ${draft.version} vs ${SERIALIZATION_VERSION}`)
  }
  
  return {
    casts: draft.casts.map(deserializeCast),
    metadata: draft.metadata,
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an empty CastItem
 */
export function createEmptyCast(): CastItem {
  return {
    id: nanoid(),
    content: '',
    media: [],
    links: [],
  }
}

/**
 * Create a CastItem with initial content
 */
export function createCast(content: string, media: MediaFile[] = [], links: LinkEmbed[] = []): CastItem {
  return {
    id: nanoid(),
    content,
    media,
    links,
  }
}

/**
 * Create empty draft metadata
 */
export function createDraftMetadata(accountId: string): DraftMetadata {
  const now = new Date().toISOString()
  return {
    id: nanoid(),
    accountId,
    channelId: null,
    scheduledAt: null,
    createdAt: now,
    updatedAt: now,
    replyToHash: null,
    quoteHash: null,
  }
}

// =============================================================================
// LOCAL STORAGE HELPERS
// =============================================================================

const DRAFT_STORAGE_KEY = 'castor_draft'
const DRAFTS_LIST_KEY = 'castor_drafts'

/**
 * Save draft to localStorage (for auto-save)
 */
export function saveLocalDraft(draft: SerializedDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch (error) {
    console.error('Failed to save local draft:', error)
  }
}

/**
 * Load draft from localStorage
 */
export function loadLocalDraft(): SerializedDraft | null {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as SerializedDraft
  } catch (error) {
    console.error('Failed to load local draft:', error)
    return null
  }
}

/**
 * Clear local draft
 */
export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear local draft:', error)
  }
}

/**
 * Check if there's a local draft
 */
export function hasLocalDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

// =============================================================================
// CLONE / COPY UTILITIES
// =============================================================================

/**
 * Deep clone a CastItem
 */
export function cloneCast(cast: CastItem): CastItem {
  return {
    id: nanoid(), // New ID for clone
    content: cast.content,
    media: cast.media.map(m => ({ ...m })),
    links: cast.links.map(l => ({ ...l })),
  }
}

/**
 * Deep clone multiple casts
 */
export function cloneCasts(casts: CastItem[]): CastItem[] {
  return casts.map(cloneCast)
}
