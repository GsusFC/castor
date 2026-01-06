'use client'

import { memo } from 'react'
import Image from 'next/image'
import { Globe, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MorphText } from '@/components/ui/MorphText'
import { renderCastText } from '@/lib/cast-text'
import { HLSVideo } from '@/components/ui/HLSVideo'
import {
  CastRenderer,
  TweetRenderer,
  YouTubeRenderer,
  LinkRenderer,
  extractYouTubeId,
  isFarcasterCastUrl,
} from '@/components/embeds'
import { isNextImageAllowedSrc } from './utils'
import type { Cast } from './types'

interface CastContentProps {
  cast: Cast
  displayText: string
  showFullText: boolean
  needsTruncation: boolean
  showTranslation: boolean
  translation: string | null
  showAllImages: boolean
  onToggleFullText: () => void
  onToggleShowAllImages: () => void
  onSelectUser: (username: string) => void
  onSelectChannel: (channelId: string) => void
  onOpenTicker: (ticker: string) => void
  onOpenMiniApp?: (url: string, title: string) => void
  onOpenCast?: (castHash: string) => void
  onOpenLightbox: (urls: string[], index: number) => void
}

function CastContentComponent({
  cast,
  displayText,
  showFullText,
  needsTruncation,
  showTranslation,
  translation,
  showAllImages,
  onToggleFullText,
  onToggleShowAllImages,
  onSelectUser,
  onSelectChannel,
  onOpenTicker,
  onOpenMiniApp,
  onOpenCast,
  onOpenLightbox,
}: CastContentProps) {
  return (
    <div className="relative">
      {/* Indicador de traducción flotante */}
      {showTranslation && (
        <div className="absolute -top-6 right-0 flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded animate-in fade-in zoom-in duration-300">
          <Globe className="w-3 h-3" />
          <span>Translated</span>
        </div>
      )}

      {/* Texto con efecto Morph */}
      <MorphText
        text={showTranslation && translation ? translation : displayText}
        className={cn(
          "text-[15px] leading-relaxed whitespace-pre-wrap break-words transition-colors duration-300",
          showTranslation && translation
            ? "text-primary/90 font-medium"
            : "text-foreground"
        )}
        render={(text) => renderCastText(text, {
          variant: 'interactive',
          interactive: {
            onMentionClick: onSelectUser,
            onChannelClick: onSelectChannel,
            onTickerClick: onOpenTicker,
          },
        })}
      />

      {/* Botón ver más/menos */}
      {needsTruncation && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFullText()
          }}
          className="text-xs text-primary hover:underline mt-1 flex items-center gap-0.5"
        >
          {showFullText ? (
            <>show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>show more <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}

      {/* Embeds (images, videos, frames, links, quote casts) */}
      {cast.embeds && cast.embeds.length > 0 && (() => {
        // Helpers para detectar por URL cuando no hay metadata
        const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url)
        const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url) ||
          url.includes('stream.warpcast.com') || url.includes('cloudflarestream.com')

        const images = cast.embeds.filter(e => e.url && (
          e.metadata?.content_type?.startsWith('image/') ||
          (!e.metadata?.content_type && isImageUrl(e.url))
        ))
        const videos = cast.embeds.filter(e => e.url && (
          e.metadata?.content_type?.startsWith('video/') ||
          e.metadata?.video ||
          (!e.metadata?.content_type && isVideoUrl(e.url))
        ))
        // Frames/Miniapps
        const frames = cast.embeds.filter(e => e.url && (
          e.metadata?.frame?.version ||
          e.metadata?.frame?.image
        ))
        const quoteCasts = cast.embeds.filter(e => e.cast)

        type FrameItem = { kind: 'frame'; url: string; image: string; title: string }
        type ImageItem = { kind: 'image'; url: string }
        type VideoItem = { kind: 'video'; url: string; poster: string | undefined; durationS: number | undefined }
        type CarouselItem = FrameItem | ImageItem | VideoItem

        const frameItems: FrameItem[] = frames
          .map((embed) => {
            const frameImage = embed.metadata?.frame?.image || embed.metadata?.html?.ogImage?.[0]?.url
            const frameTitle = embed.metadata?.frame?.title || embed.metadata?.html?.ogTitle || 'Open Mini App'
            if (!frameImage || !embed.url) return null
            return { kind: 'frame' as const, url: embed.url, image: frameImage, title: frameTitle }
          })
          .filter((item): item is FrameItem => item !== null)

        const imageItems: ImageItem[] = images
          .map((embed) => embed.url)
          .filter((url): url is string => !!url)
          .map((url) => ({ kind: 'image' as const, url }))

        const getCloudflarePoster = (url: string): string | undefined => {
          const match = url.match(/(?:watch\.cloudflarestream\.com\/|cloudflarestream\.com\/)([^/?#]+)/)
          const id = match?.[1]
          if (!id) return undefined
          return `https://videodelivery.net/${id}/thumbnails/thumbnail.jpg`
        }

        const videoItems: VideoItem[] = videos
          .map((embed) => {
            if (!embed.url) return null
            const poster = embed.metadata?.html?.ogImage?.[0]?.url || getCloudflarePoster(embed.url)
            const durationS = embed.metadata?.video?.duration_s
            return { kind: 'video' as const, url: embed.url, poster, durationS }
          })
          .filter((item): item is VideoItem => item !== null)

        const hasCarouselMedia = images.length > 0 || videos.length > 0

        const carouselItems: CarouselItem[] = hasCarouselMedia ? [...imageItems, ...videoItems, ...frameItems] : []
        const carouselItemsToRender: CarouselItem[] = showAllImages ? carouselItems : carouselItems.slice(0, 2)
        const hiddenCarouselCount = Math.max(0, carouselItems.length - carouselItemsToRender.length)

        // Links (no images, videos, frames ni quotes)
        const processedUrls = new Set([
          ...images.map(e => e.url),
          ...videos.map(e => e.url),
          ...frames.map(e => e.url),
        ])
        const links = cast.embeds.filter(e =>
          e.url &&
          !e.cast &&
          !processedUrls.has(e.url) &&
          !e.metadata?.content_type?.startsWith('image/') &&
          !e.metadata?.content_type?.startsWith('video/')
        )

        // Separar tweets, youtube, farcaster casts y otros links
        const tweets = links.filter(e =>
          e.url && (e.url.includes('twitter.com/') || e.url.includes('x.com/')) && e.url.includes('/status/')
        )
        const youtubeLinks = links.filter(e =>
          e.url && (e.url.includes('youtube.com') || e.url.includes('youtu.be'))
        )
        const farcasterCastLinks = links.filter(e =>
          e.url && isFarcasterCastUrl(e.url)
        )
        const regularLinks = links.filter(e =>
          !tweets.some(t => t.url === e.url) &&
          !youtubeLinks.some(y => y.url === e.url) &&
          !farcasterCastLinks.some(f => f.url === e.url)
        )

        return (
          <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* Quote Casts */}
            {quoteCasts.map((embed, i) => embed.cast && (
              <CastRenderer
                key={`quote-${i}`}
                cast={embed.cast}
                onOpenCast={onOpenCast}
                onSelectUser={onSelectUser}
              />
            ))}

            {/* Media Grid */}
            {hasCarouselMedia && (
              <div className="-mx-4 sm:mx-0">
                <div className="flex gap-2 overflow-x-auto pb-2 px-4 sm:px-0 no-scrollbar">
                  {carouselItemsToRender.map((item, i) => {
                    if (item.kind === 'frame') {
                      return (
                        <button
                          key={`media-${item.kind}-${item.url}-${i}`}
                          onClick={() => onOpenMiniApp?.(item.url, item.title)}
                          aria-label={item.title}
                          className="group relative flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-[3/2] bg-muted overflow-hidden hover:opacity-95 transition-opacity rounded-xl border border-border shadow-sm"
                        >
                          {isNextImageAllowedSrc(item.image) ? (
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 600px"
                              quality={85}
                              priority={i === 0}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading={i === 0 ? undefined : "lazy"}
                            />
                          ) : (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                          <div className="absolute inset-x-0 bottom-0 p-2">
                            <div className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/30 hover:bg-primary/90">
                              {item.title}
                              <ExternalLink className="w-4 h-4" />
                            </div>
                          </div>
                        </button>
                      )
                    }

                    if (item.kind === 'video') {
                      return (
                        <div
                          key={`media-${item.kind}-${item.url}-${i}`}
                          className="relative flex-shrink-0 h-56 sm:h-64 md:h-72 overflow-hidden rounded-xl flex items-center justify-center"
                        >
                          <HLSVideo
                            src={item.url}
                            poster={item.poster}
                            className="w-auto h-full object-contain"
                          />
                          <div className="pointer-events-none absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-1 ring-white/10">
                            VIDEO
                          </div>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={`media-${item.kind}-${item.url}-${i}`}
                        onClick={() => {
                          const urls = imageItems.map((img) => img.url)
                          const foundIndex = urls.findIndex((url) => url === item.url)
                          const clampedIndex = foundIndex >= 0 ? foundIndex : 0
                          onOpenLightbox(urls, clampedIndex)
                        }}
                        aria-label="Abrir imagen"
                        className={cn(
                          "relative flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-square bg-muted overflow-hidden hover:opacity-95 transition-opacity rounded-xl"
                        )}
                      >
                        {isNextImageAllowedSrc(item.url) ? (
                          <Image
                            src={item.url}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 600px"
                            quality={85}
                            priority={i === 0}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading={i === 0 ? undefined : "lazy"}
                          />
                        ) : (
                          <img
                            src={item.url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                      </button>
                    )
                  })}

                  {hiddenCarouselCount > 0 && !showAllImages && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleShowAllImages()
                      }}
                      className="flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-square rounded-xl border border-border bg-card/60 hover:bg-card transition-colors flex items-center justify-center"
                      aria-label={`Mostrar ${hiddenCarouselCount} más`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        Mostrar {hiddenCarouselCount} más
                      </span>
                    </button>
                  )}

                  {carouselItems.length > 2 && showAllImages && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleShowAllImages()
                      }}
                      className="flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-square rounded-xl border border-border bg-card/60 hover:bg-card transition-colors flex items-center justify-center"
                      aria-label="Ver menos"
                    >
                      <span className="text-sm font-medium text-foreground">Ver menos</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Frames / Miniapps (Scroll horizontal separado para no romper el grid) */}
            {frames.length > 0 && !hasCarouselMedia && (
              <div className="-mx-4 sm:mx-0">
                <div className="flex gap-2 overflow-x-auto pb-2 px-4 sm:px-0 no-scrollbar">
                  {(showAllImages ? frameItems : frameItems.slice(0, 2)).map((item, i) => (
                    <button
                      key={`frame-${i}`}
                      onClick={() => onOpenMiniApp?.(item.url, item.title)}
                      aria-label={item.title}
                      className="group relative flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-[3/2] bg-muted overflow-hidden hover:opacity-95 transition-opacity rounded-xl border border-border shadow-sm"
                    >
                      {isNextImageAllowedSrc(item.image) ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <div className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/30 hover:bg-primary/90">
                          {item.title}
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  ))}

                  {frameItems.length > 2 && !showAllImages && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleShowAllImages()
                      }}
                      className="flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-square rounded-xl border border-border bg-card/60 hover:bg-card transition-colors flex items-center justify-center"
                      aria-label={`Mostrar ${frameItems.length - 2} frames más`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        Mostrar {frameItems.length - 2} más
                      </span>
                    </button>
                  )}

                  {frameItems.length > 2 && showAllImages && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleShowAllImages()
                      }}
                      className="flex-shrink-0 h-56 sm:h-64 md:h-72 aspect-square rounded-xl border border-border bg-card/60 hover:bg-card transition-colors flex items-center justify-center"
                      aria-label="Ver menos frames"
                    >
                      <span className="text-sm font-medium text-foreground">Ver menos</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tweet Embeds */}
            {tweets.map((embed, i) => {
              const tweetId = embed.url?.match(/status\/(\d+)/)?.[1]
              return tweetId ? (
                <TweetRenderer
                  key={`tweet-${i}`}
                  tweetId={tweetId}
                  className="max-w-xl mx-auto max-h-[520px] overflow-auto overscroll-contain"
                />
              ) : null
            })}

            {/* YouTube Embeds */}
            {youtubeLinks.map((embed, i) => {
              const videoId = extractYouTubeId(embed.url!)
              return videoId ? (
                <YouTubeRenderer key={`yt-${i}`} videoId={videoId} className="max-w-xl mx-auto" />
              ) : null
            })}

            {/* Farcaster Cast Links */}
            {farcasterCastLinks.map((embed, i) => (
              <CastRenderer
                key={`fc-${i}`}
                url={embed.url!}
                onOpenCast={onOpenCast}
                onSelectUser={onSelectUser}
              />
            ))}

            {/* Link Previews */}
            {regularLinks.map((embed, i) => (
              <LinkRenderer key={`link-${i}`} url={embed.url!} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}

export const CastContent = memo(CastContentComponent)
