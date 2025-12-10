'use client'

/**
 * EmbedDisplay - Para uso en Feed
 * Muestra embeds en modo solo lectura (sin opción de eliminar)
 */

import { cn } from '@/lib/utils'
import {
  ImageRenderer,
  VideoRenderer,
  TweetRenderer,
  YouTubeRenderer,
  CastRenderer,
  LinkRenderer,
  extractYouTubeId,
  isFarcasterCastUrl,
} from './renderers'
import type { EmbedData, EmbedCast, EmbedMetadata } from './types'

interface EmbedDisplayProps {
  url?: string
  cast?: EmbedCast
  metadata?: EmbedMetadata
  className?: string
  // Para frames
  isFrame?: boolean
  onOpenMiniApp?: (url: string) => void
}

// Detectores de tipo
const isImageUrl = (url: string): boolean => 
  /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url)

const isVideoUrl = (url: string): boolean => 
  /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url) ||
  url.includes('stream.warpcast.com') ||
  url.includes('cloudflarestream.com')

const isTweetUrl = (url: string): boolean => 
  (url.includes('twitter.com') || url.includes('x.com')) && url.includes('/status/')

const isYouTubeUrl = (url: string): boolean => 
  url.includes('youtube.com') || url.includes('youtu.be')

const extractTweetId = (url: string): string | null => {
  const match = url.match(/status\/(\d+)/)
  return match ? match[1] : null
}

export function EmbedDisplay({
  url,
  cast,
  metadata,
  className,
  isFrame = false,
  onOpenMiniApp,
}: EmbedDisplayProps) {
  // Cast embebido (quote cast)
  if (cast) {
    return <CastRenderer cast={cast} className={className} />
  }

  if (!url) return null

  // Image (por content-type implícito en metadata o extensión)
  if (isImageUrl(url)) {
    return <ImageRenderer url={url} className={className} />
  }

  // Video
  if (isVideoUrl(url)) {
    return <VideoRenderer url={url} className={className} />
  }

  // Tweet
  if (isTweetUrl(url)) {
    const tweetId = extractTweetId(url)
    if (tweetId) {
      return <TweetRenderer tweetId={tweetId} className={className} />
    }
  }

  // YouTube
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeId(url)
    if (videoId) {
      return <YouTubeRenderer videoId={videoId} className={className} />
    }
  }

  // Farcaster Cast link
  if (isFarcasterCastUrl(url)) {
    return <CastRenderer url={url} className={className} />
  }

  // Frame / MiniApp
  if (isFrame || metadata?.isFrame) {
    return (
      <LinkRenderer 
        url={url}
        metadata={metadata}
        isFrame
        className={className}
      />
    )
  }

  // Default: Link preview
  return <LinkRenderer url={url} metadata={metadata} className={className} />
}
