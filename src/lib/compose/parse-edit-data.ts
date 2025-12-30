/**
 * Utilities for parsing edit cast data
 */

import type { MediaFile, LinkEmbed, CastItem } from '@/components/compose/types'

/**
 * Raw embed data from API (edit cast response)
 */
export interface RawEmbed {
  url: string
  type: 'image' | 'video'
  thumbnailUrl?: string | null
  cloudflareId?: string | null
  livepeerAssetId?: string | null
  livepeerPlaybackId?: string | null
  videoStatus?: string | null
}

/**
 * Check if a URL/embed is a media file (image/video)
 */
export function isMediaEmbed(embed: RawEmbed): boolean {
  const url = embed.url || ''
  
  // Check by provider IDs
  const isCloudflare = Boolean(embed.cloudflareId) ||
    url.includes('cloudflare') ||
    url.includes('imagedelivery.net')
  
  const isLivepeer = Boolean(embed.livepeerAssetId) ||
    url.includes('livepeer') ||
    url.includes('lp-playback')
  
  // Check by file extension
  const hasMediaExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m3u8)$/i.test(url)
  
  return isCloudflare || isLivepeer || hasMediaExtension
}

/**
 * Parse raw embeds into media files
 */
export function parseMediaFromEmbeds(embeds: RawEmbed[]): MediaFile[] {
  return embeds
    .filter(isMediaEmbed)
    .map((m) => ({
      preview: m.thumbnailUrl || m.url,
      url: m.url,
      type: m.type,
      uploading: false,
      cloudflareId: m.cloudflareId || undefined,
      livepeerAssetId: m.livepeerAssetId || undefined,
      livepeerPlaybackId: m.livepeerPlaybackId || undefined,
      videoStatus: (m.videoStatus as MediaFile['videoStatus']) || undefined,
    }))
}

/**
 * Parse raw embeds into link embeds (non-media URLs)
 */
export function parseLinksFromEmbeds(embeds: RawEmbed[]): LinkEmbed[] {
  return embeds
    .filter((m) => !isMediaEmbed(m))
    .map((m) => ({ url: m.url }))
}

/**
 * Edit cast data from API
 */
export interface EditCastData {
  id: string
  content: string
  accountId: string
  channelId?: string | null
  scheduledAt: string
  media?: RawEmbed[]
}

/**
 * Parse edit cast data into a CastItem for the editor
 */
export function parseEditCastToCastItem(editCast: EditCastData): CastItem {
  const rawEmbeds = editCast.media || []
  
  return {
    id: editCast.id,
    content: editCast.content,
    media: parseMediaFromEmbeds(rawEmbeds),
    links: parseLinksFromEmbeds(rawEmbeds),
  }
}
