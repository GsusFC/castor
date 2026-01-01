/**
 * Utility functions for building embed arrays from cast data
 */

import { normalizeHttpUrl } from '@/lib/url-utils'
import type { CastItem, MediaFile, LinkEmbed } from '@/components/compose/types'

/**
 * Embed structure for API requests
 */
export interface EmbedPayload {
  url: string
  type?: 'image' | 'video'
  cloudflareId?: string
  livepeerAssetId?: string
  livepeerPlaybackId?: string
  videoStatus?: string
}

/**
 * Options for building embeds
 */
export interface BuildEmbedsOptions {
  /**
   * Include media metadata (cloudflareId, livepeerAssetId, etc.)
   * Set to false for publish (only URL needed)
   * Set to true for schedule/draft (metadata needed for video status)
   */
  includeMetadata?: boolean
}

/**
 * Build embed array from a single cast's media and links
 */
export function buildEmbedsFromCast(
  cast: CastItem,
  options: BuildEmbedsOptions = {}
): EmbedPayload[] {
  const { includeMetadata = true } = options

  const mediaEmbeds = buildMediaEmbeds(cast.media, includeMetadata)
  const linkEmbeds = buildLinkEmbeds(cast.links)

  return [...mediaEmbeds, ...linkEmbeds]
}

/**
 * Build embed array from media files
 */
export function buildMediaEmbeds(
  media: MediaFile[],
  includeMetadata = true
): EmbedPayload[] {
  return media
    .filter((m) => m.url)
    .map((m) => {
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
    })
}

/**
 * Build embed array from link embeds
 */
export function buildLinkEmbeds(links: LinkEmbed[]): EmbedPayload[] {
  return links.map((l) => ({ url: normalizeHttpUrl(l.url) }))
}

/**
 * Build embeds for all casts in a thread (for schedule-thread endpoint)
 */
export function buildThreadEmbedsPayload(
  casts: CastItem[]
): Array<{ content: string; embeds: EmbedPayload[] }> {
  return casts.map((cast) => ({
    content: cast.content,
    embeds: buildEmbedsFromCast(cast, { includeMetadata: true }),
  }))
}
