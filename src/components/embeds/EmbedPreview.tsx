'use client'

/**
 * EmbedPreview - Para uso en Composer
 * Muestra preview de embeds con opción de eliminar
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
import type { EmbedData, EmbedMetadata } from './types'

interface EmbedPreviewProps {
  url: string
  metadata?: EmbedMetadata
  onRemove: () => void
  className?: string
  // Estados
  loading?: boolean
  error?: boolean
  // Específico para frames
  isFrame?: boolean
  // Vista compacta para móvil
  compact?: boolean
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

export function EmbedPreview({
  url,
  metadata,
  onRemove,
  className,
  loading = false,
  error = false,
  isFrame = false,
  compact = false,
}: EmbedPreviewProps) {
  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center gap-3 p-3 border rounded-lg bg-muted/50', className)}>
        <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground truncate">{url}</span>
      </div>
    )
  }

  // Image
  if (metadata?.image && isImageUrl(url)) {
    return (
      <ImageRenderer 
        url={url} 
        className={className}
        onRemove={onRemove}
        showRemove
      />
    )
  }

  // Video
  if (isVideoUrl(url)) {
    return (
      <VideoRenderer 
        url={url} 
        className={className}
        onRemove={onRemove}
        showRemove
      />
    )
  }

  // Tweet
  if (isTweetUrl(url)) {
    const tweetId = extractTweetId(url)
    if (tweetId) {
      return (
        <TweetRenderer 
          tweetId={tweetId} 
          className={className}
          onRemove={onRemove}
          showRemove
        />
      )
    }
  }

  // YouTube
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeId(url)
    if (videoId) {
      return (
        <YouTubeRenderer 
          videoId={videoId} 
          className={className}
          onRemove={onRemove}
          showRemove
        />
      )
    }
  }

  // Farcaster Cast
  if (isFarcasterCastUrl(url)) {
    return (
      <CastRenderer 
        url={url} 
        className={className}
        onRemove={onRemove}
        showRemove
      />
    )
  }

  // Frame / MiniApp
  if (isFrame || metadata?.isFrame) {
    return (
      <LinkRenderer 
        url={url}
        metadata={metadata}
        isFrame
        className={className}
        onRemove={onRemove}
        showRemove
        compact={compact}
      />
    )
  }

  // Default: Link
  return (
    <LinkRenderer 
      url={url}
      metadata={metadata}
      className={className}
      onRemove={onRemove}
      showRemove
      compact={compact}
    />
  )
}
