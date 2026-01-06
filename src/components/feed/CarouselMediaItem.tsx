'use client'

import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HLSVideo } from '@/components/ui/HLSVideo'
import { generateSrcSet, SIZES_CAROUSEL } from '@/lib/image-utils'

type MediaSize = 'small' | 'medium' | 'large'

const MEDIA_SIZE_CLASSES: Record<MediaSize, string> = {
  small: 'h-48',
  medium: 'h-56 sm:h-64',
  large: 'h-64 sm:h-72 md:h-80',
}

interface FrameItemProps {
  url: string
  image: string
  title: string
  size?: MediaSize
  onClick?: () => void
  isNextImageAllowed: boolean
}

export function FrameMediaItem({
  url,
  image,
  title,
  size = 'medium',
  onClick,
  isNextImageAllowed,
}: FrameItemProps) {
  return (
    <button
      onClick={onClick}
      aria-label={title}
      className={cn(
        'group relative flex-shrink-0 aspect-[3/2] bg-muted overflow-hidden hover:opacity-95 transition-opacity rounded-xl border border-border shadow-sm',
        MEDIA_SIZE_CLASSES[size]
      )}
    >
      {isNextImageAllowed ? (
        <Image
          src={image}
          alt={title}
          fill
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          unoptimized
        />
      ) : (
        <img
          src={image}
          srcSet={generateSrcSet(image)}
          sizes={SIZES_CAROUSEL}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2">
        <div className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/30 hover:bg-primary/90">
          {title}
          <ExternalLink className="w-4 h-4" />
        </div>
      </div>
    </button>
  )
}

interface VideoItemProps {
  url: string
  poster?: string
  size?: MediaSize
}

export function VideoMediaItem({ url, poster, size = 'medium' }: VideoItemProps) {
  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden rounded-xl flex items-center justify-center',
        MEDIA_SIZE_CLASSES[size]
      )}
    >
      <HLSVideo src={url} poster={poster} className="w-auto h-full object-contain" />
      <div className="pointer-events-none absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-1 ring-white/10">
        VIDEO
      </div>
    </div>
  )
}

interface ImageItemProps {
  url: string
  size?: MediaSize
  onClick?: () => void
  isNextImageAllowed: boolean
}

export function ImageMediaItem({
  url,
  size = 'medium',
  onClick,
  isNextImageAllowed,
}: ImageItemProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Abrir imagen"
      className={cn(
        'relative flex-shrink-0 aspect-square bg-muted overflow-hidden hover:opacity-95 transition-opacity rounded-xl',
        MEDIA_SIZE_CLASSES[size]
      )}
    >
      {isNextImageAllowed ? (
        <Image
          src={url}
          alt=""
          fill
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          unoptimized
        />
      ) : (
        <img
          src={url}
          srcSet={generateSrcSet(url)}
          sizes={SIZES_CAROUSEL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
    </button>
  )
}

interface ShowMoreButtonProps {
  count: number
  onClick: () => void
  size?: MediaSize
  type?: 'more' | 'less'
}

export function ShowMoreButton({
  count,
  onClick,
  size = 'medium',
  type = 'more',
}: ShowMoreButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 aspect-square rounded-xl border border-border bg-card/60 hover:bg-card transition-colors flex items-center justify-center',
        MEDIA_SIZE_CLASSES[size]
      )}
      aria-label={type === 'more' ? `Mostrar ${count} más` : 'Ver menos'}
    >
      <span className="text-sm font-medium text-foreground">
        {type === 'more' ? `Mostrar ${count} más` : 'Ver menos'}
      </span>
    </button>
  )
}
