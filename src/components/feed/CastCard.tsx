'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Heart, Repeat2, MessageCircle, Share, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserPopover } from './UserPopover'
import { HLSVideo } from '@/components/ui/HLSVideo'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTickerDrawer } from '@/context/TickerDrawerContext'
import { CastHeader, CastActions, CastContent } from './cast-card'

// Lazy load modals
const ImageLightbox = dynamic(
  () => import('./cast-card/ImageLightbox').then(mod => ({ default: mod.ImageLightbox }))
)

const VideoModal = dynamic(
  () => import('./cast-card/VideoModal').then(mod => ({ default: mod.VideoModal }))
)

interface CastAuthor {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  power_badge?: boolean
  pro?: { status: string }
}

interface CastChannel {
  id: string
  name: string
  image_url?: string
}

interface CastReactions {
  likes_count: number
  recasts_count: number
}

interface EmbeddedCast {
  hash: string
  text: string
  timestamp: string
  author: {
    fid: number
    username: string
    display_name: string
    pfp_url?: string
  }
  embeds?: { url: string; metadata?: { content_type?: string } }[]
  channel?: { id: string; name: string }
}

interface CastEmbed {
  url?: string
  cast?: EmbeddedCast
  metadata?: {
    content_type?: string
    image?: { width_px: number; height_px: number }
    video?: {
      streams?: { codec_name?: string }[]
      duration_s?: number
    }
    html?: {
      ogImage?: { url: string }[]
      ogTitle?: string
      ogDescription?: string
      favicon?: string
    }
    frame?: {
      version?: string
      title?: string
      image?: string
      buttons?: { title?: string; index?: number }[]
    }
  }
}

const MUTED_FIDS_STORAGE_KEY = 'castor:mutedFids'
const BLOCKED_FIDS_STORAGE_KEY = 'castor:blockedFids'
const MODERATION_UPDATED_EVENT = 'castor:moderation-updated'

interface Cast {
  hash: string
  text: string
  timestamp: string
  author: CastAuthor
  reactions: CastReactions
  replies: { count: number }
  embeds?: CastEmbed[]
  channel?: CastChannel
}

interface CastCardProps {
  cast: Cast
  onOpenMiniApp?: (url: string, title: string) => void
  onOpenCast?: (castHash: string) => void
  onQuote?: (castUrl: string) => void
  onDelete?: (castHash: string) => void
  onReply?: (cast: Cast) => void
  onSelectUser?: (username: string) => void
  currentUserFid?: number
  currentUserFids?: number[]
  isPro?: boolean
}

const NEXT_IMAGE_ALLOWED_HOSTNAMES = new Set<string>([
  'imagedelivery.net',
  'videodelivery.net',
  'watch.cloudflarestream.com',
  'avatar.vercel.sh',
  'i.imgur.com',
  'imgur.com',
  'pbs.twimg.com',
  'media.giphy.com',
  'i.giphy.com',
  'giphy.com',
  'cdn.discordapp.com',
  'firesidebase.vercel.app',
  'upgrader.co',
])

const isNextImageAllowedSrc = (src: string): boolean => {
  try {
    const hostname = new URL(src).hostname
    if (NEXT_IMAGE_ALLOWED_HOSTNAMES.has(hostname)) return true
    if (hostname.endsWith('.googleusercontent.com')) return true
    return false
  } catch {
    return false
  }
}

function CastCardComponent({
  cast,
  onOpenMiniApp,
  onOpenCast,
  onQuote,
  onDelete,
  onReply,
  onSelectUser,
  currentUserFid,
  currentUserFids,
  isPro = false,
}: CastCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { openTicker } = useTickerDrawer()
  const [translation, setTranslation] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const [videoModal, setVideoModal] = useState<{ url: string; poster?: string } | null>(null)
  const [showAllImages, setShowAllImages] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFullText, setShowFullText] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)

  const isOwnCast = Array.isArray(currentUserFids) && currentUserFids.length > 0
    ? currentUserFids.includes(cast.author.fid)
    : currentUserFid === cast.author.fid
  const castUrl = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`

  // Truncar texto largo (> 280 caracteres)
  const MAX_TEXT_LENGTH = 280
  const needsTruncation = cast.text.length > MAX_TEXT_LENGTH
  const displayText = showFullText || !needsTruncation
    ? cast.text
    : cast.text.slice(0, MAX_TEXT_LENGTH) + '...'

  const handleSelectUser = useCallback((username: string) => {
    if (onSelectUser) {
      onSelectUser(username)
      return
    }
    const qs = new URLSearchParams()
    qs.set('user', username)
    router.push(`/?${qs.toString()}`)
  }, [onSelectUser, router])

  const handleSelectChannel = useCallback((channelId: string) => {
    const qs = new URLSearchParams()
    qs.set('channel', channelId)
    router.push(`/?${qs.toString()}`)
  }, [router])

  const readFidListFromStorage = useCallback((key: string): number[] => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    } catch {
      return []
    }
  }, [])

  const writeFidListToStorage = useCallback((key: string, fids: number[]): void => {
    const unique = Array.from(new Set(fids)).filter((v) => Number.isFinite(v))
    localStorage.setItem(key, JSON.stringify(unique))
  }, [])

  const handleCopyCastHash = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(cast.hash)
      toast.success('Cast hash copied')
      setShowMoreMenu(false)
    } catch {
      toast.error('Copy error')
    }
  }, [cast.hash])

  const handleMuteUser = useCallback((): void => {
    const fid = cast.author.fid
    if (!Number.isFinite(fid)) return

    if (currentUserFid && fid === currentUserFid) {
      toast.error('You cannot mute yourself')
      return
    }

    const current = readFidListFromStorage(MUTED_FIDS_STORAGE_KEY)
    writeFidListToStorage(MUTED_FIDS_STORAGE_KEY, [...current, fid])
    window.dispatchEvent(new Event(MODERATION_UPDATED_EVENT))
    toast.success(`Muted @${cast.author.username}`)
    setShowMoreMenu(false)
  }, [cast.author.fid, cast.author.username, currentUserFid, readFidListFromStorage, writeFidListToStorage])

  const handleBlockUser = useCallback((): void => {
    const fid = cast.author.fid
    if (!Number.isFinite(fid)) return

    if (currentUserFid && fid === currentUserFid) {
      toast.error('You cannot block yourself')
      return
    }

    const confirmed = confirm(`Block @${cast.author.username}?`)
    if (!confirmed) return

    const current = readFidListFromStorage(BLOCKED_FIDS_STORAGE_KEY)
    writeFidListToStorage(BLOCKED_FIDS_STORAGE_KEY, [...current, fid])
    window.dispatchEvent(new Event(MODERATION_UPDATED_EVENT))
    toast.success(`Blocked @${cast.author.username}`)
    setShowMoreMenu(false)
  }, [cast.author.fid, cast.author.username, currentUserFid, readFidListFromStorage, writeFidListToStorage])

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Unificado: bocadillo también expande el cast
  const handleToggleReplies = async (e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (isExpanded) {
      // Si ya está expandido, colapsar
      setIsExpanded(false)
      return
    }

    // Expandir y cargar replies
    setIsExpanded(true)

    if (replies.length === 0 && cast.replies.count > 0) {
      setLoadingReplies(true)
      try {
        const res = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`)
        const data = await res.json()
        setReplies(data.replies || [])
      } catch (error) {
        console.error('Error loading replies:', error)
      } finally {
        setLoadingReplies(false)
      }
    }
  }


  const handleDelete = async () => {
    if (!onDelete || isDeleting) return

    if (!confirm('Are you sure you want to delete this cast?')) return

    setIsDeleting(true)
    try {
      onDelete(cast.hash)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTranslate = async () => {
    if (translation) {
      setShowTranslation(!showTranslation)
      return
    }

    setIsTranslating(true)
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cast.text }),
      })
      const data = await res.json()
      if (data.translation) {
        setTranslation(data.translation)
        setShowTranslation(true)
      }
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setIsTranslating(false)
    }
  }

  const handleShare = async () => {
    const url = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`

    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Copy error')
    }
  }

  const getShortTimeAgo = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    return `${diffDays}d`
  }

  const timeAgo = getShortTimeAgo(cast.timestamp)

  const handleOpenCast = () => {
    onOpenCast?.(cast.hash)
  }

  const handleOpenCastKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenCast) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleOpenCast()
  }

  const handleCloseLightbox = () => {
    setLightbox(null)
  }

  const handleLightboxPrev = () => {
    setLightbox((current) => {
      if (!current) return current
      if (current.urls.length <= 1) return current
      const nextIndex = (current.index - 1 + current.urls.length) % current.urls.length
      return { ...current, index: nextIndex }
    })
  }

  const handleLightboxNext = () => {
    setLightbox((current) => {
      if (!current) return current
      if (current.urls.length <= 1) return current
      const nextIndex = (current.index + 1) % current.urls.length
      return { ...current, index: nextIndex }
    })
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "p-3 sm:p-4 border rounded-lg bg-card transition-all",
        isExpanded
          ? "border-primary/50 shadow-lg ring-1 ring-primary/20"
          : "border-border hover:bg-muted/30"
      )}
    >
      {/* Header */}
      <CastHeader
        cast={cast}
        isOwnCast={isOwnCast}
        onSelectUser={onSelectUser}
        onCopyCastHash={handleCopyCastHash}
        onMuteUser={handleMuteUser}
        onBlockUser={handleBlockUser}
        onDelete={onDelete ? handleDelete : undefined}
        showMoreMenu={showMoreMenu}
        setShowMoreMenu={setShowMoreMenu}
        isDeleting={isDeleting}
      />

      {/* Content */}
      <div
        onClick={onOpenCast ? handleOpenCast : undefined}
        onKeyDown={handleOpenCastKeyDown}
        role={onOpenCast ? 'link' : undefined}
        tabIndex={onOpenCast ? 0 : undefined}
        className={cn(
          "mt-3 ml-0 sm:ml-13",
          onOpenCast && "cursor-pointer"
        )}
      >
        <CastContent
          cast={cast}
          displayText={displayText}
          showFullText={showFullText}
          needsTruncation={needsTruncation}
          showTranslation={showTranslation}
          translation={translation}
          showAllImages={showAllImages}
          onToggleFullText={() => setShowFullText(!showFullText)}
          onToggleShowAllImages={() => setShowAllImages(!showAllImages)}
          onSelectUser={handleSelectUser}
          onSelectChannel={handleSelectChannel}
          onOpenTicker={openTicker}
          onOpenMiniApp={onOpenMiniApp}
          onOpenCast={onOpenCast}
          onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
        />
      </div>

      {/* Actions - distributed across width */}
      <CastActions
        cast={cast}
        isExpanded={isExpanded}
        loadingReplies={loadingReplies}
        showTranslation={showTranslation}
        isTranslating={isTranslating}
        onToggleReplies={handleToggleReplies}
        onReply={onReply}
        onOpenCast={onOpenCast}
        onQuote={onQuote}
        onTranslate={handleTranslate}
        onShare={handleShare}
      />

      {/* Expanded Section: Composer first, then Replies */}
      {isExpanded && (
        <div className="mt-4 ml-0 sm:ml-13 space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* Composer placeholder - Opens modal */}
          <div className="pt-4 border-t border-border">
            <button
              onClick={() => onReply?.(cast)}
              className="w-full px-3 py-3 text-sm text-left text-muted-foreground rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-colors"
            >
              Responder a @{cast.author.username}...
            </button>
          </div>

          {/* Replies - Scrollable area with max 5 */}
          {loadingReplies ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : replies.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-4 border-l-2 border-border/50 pl-4 ml-2 scrollbar-thin">
              {replies.slice(0, 5).map((reply) => (
                <div
                  key={reply.hash}
                  onClick={() => onOpenCast?.(reply.hash)}
                  onKeyDown={(e) => {
                    if (!onOpenCast) return
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    onOpenCast(reply.hash)
                  }}
                  role={onOpenCast ? 'link' : undefined}
                  tabIndex={onOpenCast ? 0 : undefined}
                  className={cn(
                    "text-sm group rounded-lg -mx-2 px-2 py-2",
                    onOpenCast && "cursor-pointer hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {reply.author && (
                      <UserPopover
                        fid={reply.author.fid}
                        username={reply.author.username}
                        displayName={reply.author.display_name}
                        pfpUrl={reply.author.pfp_url}
                      >
                        <Image
                          src={reply.author.pfp_url || `https://avatar.vercel.sh/${reply.author.username}`}
                          alt={reply.author.username}
                          width={24}
                          height={24}
                          sizes="24px"
                          quality={75}
                          className="w-6 h-6 rounded-full hover:opacity-80 object-cover mt-0.5"
                        />
                      </UserPopover>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-xs hover:underline cursor-pointer">
                          {reply.author?.display_name}
                        </span>
                        <span className="text-muted-foreground text-xs">@{reply.author?.username}</span>
                        <span className="text-muted-foreground text-[10px] mx-0.5">·</span>
                        <span className="text-muted-foreground text-[10px]">
                          {getShortTimeAgo(reply.timestamp)}
                        </span>
                      </div>

                      <p className="text-[15px] leading-relaxed text-foreground mt-0.5 break-words">{reply.text}</p>

                      {/* Imágenes en respuestas */}
                      {reply.embeds && reply.embeds.length > 0 && (
                        <div className="mt-2 flex gap-2 overflow-x-auto">
                          {reply.embeds
                            .filter((e: any) => e.metadata?.content_type?.startsWith('image/') || e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
                            .map((e: any, idx: number) => (
                              <Image
                                key={idx}
                                src={e.url}
                                alt=""
                                width={200}
                                height={96}
                                sizes="200px"
                                quality={80}
                                className="h-24 w-auto rounded-lg object-cover border border-border"
                              />
                            ))
                          }
                        </div>
                      )}

                      <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          className="flex items-center gap-1.5 hover:text-pink-500 transition-colors"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await fetch('/api/feed/reaction', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ castHash: reply.hash, reactionType: 'like' }),
                              })
                              toast.success('Like added')
                            } catch {
                              toast.error('Error liking')
                            }
                          }}
                        >
                          <Heart className="w-4 h-4" />
                          {reply.reactions?.likes_count || 0}
                        </button>
                        <button
                          className="flex items-center gap-1.5 hover:text-green-500 transition-colors"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await fetch('/api/feed/reaction', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ castHash: reply.hash, reactionType: 'recast' }),
                              })
                              toast.success('Recast added')
                            } catch {
                              toast.error('Error recasting')
                            }
                          }}
                        >
                          <Repeat2 className="w-4 h-4" />
                          {reply.reactions?.recasts_count || 0}
                        </button>
                        <button
                          className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Construir un Cast-like object para el modal
                            onReply?.({
                              hash: reply.hash,
                              text: reply.text,
                              timestamp: reply.timestamp,
                              author: reply.author,
                              reactions: reply.reactions || { likes_count: 0, recasts_count: 0 },
                              replies: { count: 0 },
                            })
                          }}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            const replyUrl = `https://farcaster.xyz/${reply.author?.username}/${reply.hash.slice(0, 10)}`
                            navigator.clipboard.writeText(replyUrl)
                            toast.success('Link copied')
                          }}
                        >
                          <Share className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {replies.length > 5 && (
                <button
                  className="w-full text-xs text-muted-foreground text-center py-2 hover:text-primary transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenCast?.(cast.hash)
                  }}
                >
                  Ver {replies.length - 5} respuestas más
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lazy loaded modals */}
      {videoModal && (
        <VideoModal
          url={videoModal.url}
          poster={videoModal.poster}
          onClose={() => setVideoModal(null)}
        />
      )}

      {lightbox && (
        <ImageLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={handleCloseLightbox}
          onPrev={handleLightboxPrev}
          onNext={handleLightboxNext}
        />
      )}
    </div>
  )
}

// Custom comparison function for memo
function arePropsEqual(prevProps: CastCardProps, nextProps: CastCardProps) {
  // Compare cast hash (primary identifier)
  if (prevProps.cast.hash !== nextProps.cast.hash) return false

  // Compare cast content fields that can change
  if (prevProps.cast.text !== nextProps.cast.text) return false
  if (prevProps.cast.reactions.likes_count !== nextProps.cast.reactions.likes_count) return false
  if (prevProps.cast.reactions.recasts_count !== nextProps.cast.reactions.recasts_count) return false
  if (prevProps.cast.replies.count !== nextProps.cast.replies.count) return false

  // Compare callback functions (by reference)
  if (prevProps.onOpenMiniApp !== nextProps.onOpenMiniApp) return false
  if (prevProps.onOpenCast !== nextProps.onOpenCast) return false
  if (prevProps.onQuote !== nextProps.onQuote) return false
  if (prevProps.onDelete !== nextProps.onDelete) return false
  if (prevProps.onReply !== nextProps.onReply) return false
  if (prevProps.onSelectUser !== nextProps.onSelectUser) return false

  // Compare user context
  if (prevProps.currentUserFid !== nextProps.currentUserFid) return false
  if (prevProps.isPro !== nextProps.isPro) return false

  // Compare currentUserFids array (shallow comparison for length and first item)
  const prevFids = prevProps.currentUserFids
  const nextFids = nextProps.currentUserFids
  if (prevFids?.length !== nextFids?.length) return false
  if (prevFids && nextFids && prevFids[0] !== nextFids[0]) return false

  return true
}

export const CastCard = memo(CastCardComponent, arePropsEqual)
