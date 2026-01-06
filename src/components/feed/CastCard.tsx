'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import Image from 'next/image'
import { Heart, Repeat2, MessageCircle, Globe, X, Send, Loader2, Share, Image as ImageIcon, Film, ExternalLink, Trash2, Quote, MoreHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Copy, VolumeX, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadMedia } from '@/lib/media-upload'
import { ApiRequestError } from '@/lib/fetch-json'
import { UserPopover } from './UserPopover'
import { HLSVideo } from '@/components/ui/HLSVideo'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { GifPicker } from '@/components/compose/GifPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AIReplyDialog } from './AIReplyDialog'
import { useRouter } from 'next/navigation'
import {
  CastRenderer,
  TweetRenderer,
  YouTubeRenderer,
  LinkRenderer,
  extractYouTubeId,
  isFarcasterCastUrl,
} from '@/components/embeds'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { useSelectedAccount } from '@/context/SelectedAccountContext'

import { MorphText } from '@/components/ui/MorphText'
import { ScrambleText } from '@/components/ui/ScrambleText'
import { renderCastText } from '@/lib/cast-text'
import { useTickerDrawer } from '@/context/TickerDrawerContext'
import { generateSrcSet, SIZES_CAROUSEL } from '@/lib/image-utils'

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

const CastCardComponent = function CastCard({
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
  const { selectedAccountId } = useSelectedAccount()
  const [translation, setTranslation] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isRecasted, setIsRecasted] = useState(false)
  const [likesCount, setLikesCount] = useState(cast.reactions.likes_count)
  const [recastsCount, setRecastsCount] = useState(cast.reactions.recasts_count)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const [videoModal, setVideoModal] = useState<{ url: string; poster?: string } | null>(null)
  const [showAllImages, setShowAllImages] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyMedia, setReplyMedia] = useState<{ preview: string; url?: string; uploading: boolean; isGif?: boolean } | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showAIPicker, setShowAIPicker] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const replyIdempotencyKeyRef = useRef<string | null>(null)

  useEffect(() => {
    replyIdempotencyKeyRef.current = null
  }, [replyText, replyMedia?.url])
  const [aiReplyTarget, setAiReplyTarget] = useState<Cast | null>(null)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)
  const [showRecastMenu, setShowRecastMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFullText, setShowFullText] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const lightboxDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lightboxDragDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lightboxDidSwipeRef = useRef(false)

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Auto-resize textarea cuando cambia el texto (ej: AI genera contenido)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [replyText])

  // Manejar selección de sugerencia AI
  const handleAIPublish = (text: string) => {
    setReplyText(text)
  }

  // Traducir respuesta a inglés
  const handleTranslateReply = async () => {
    if (!replyText.trim()) return
    setIsTranslatingReply(true)
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText, targetLanguage: 'English' }),
      })
      const data = await res.json()
      if (data.translation) {
        setReplyText(data.translation)
      }
    } catch (error) {
      toast.error('Translation error')
    } finally {
      setIsTranslatingReply(false)
    }
  }

  // Subir imagen para reply
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Only images allowed')
      return
    }

    // Crear preview
    const preview = URL.createObjectURL(file)
    setReplyMedia({ preview, uploading: true })

    try {
      const result = await uploadMedia(file)
      if (result.type !== 'image') throw new Error('Unexpected upload result')

      setReplyMedia({ preview, url: result.url, uploading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al subir imagen'
      if (error instanceof ApiRequestError) {
        console.warn('Upload error:', error)
      } else {
        console.error('Upload error:', error)
      }

      toast.error(errorMessage)
      setReplyMedia(null)
    }

    // Limpiar input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Seleccionar GIF
  const handleGifSelect = (gifUrl: string) => {
    setReplyMedia({ preview: gifUrl, url: gifUrl, uploading: false, isGif: true })
    setShowGifPicker(false)
  }

  // Enviar respuesta
  const handleSendReply = async () => {
    if ((!replyText.trim() && !replyMedia?.url) || isSendingReply) return
    if (replyMedia?.uploading) {
      toast.error('Please wait for upload to finish')
      return
    }

    if (!selectedAccountId) {
      toast.error('Select an account to publish')
      return
    }

    setIsSendingReply(true)
    try {
      if (!replyIdempotencyKeyRef.current) {
        replyIdempotencyKeyRef.current = crypto.randomUUID()
      }

      const embeds = replyMedia?.url ? [{ url: replyMedia.url }] : undefined

      const res = await fetch('/api/casts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          content: replyText,
          parentHash: cast.hash,
          embeds,
          idempotencyKey: replyIdempotencyKeyRef.current,
        }),
      })

      if (!res.ok) throw new Error('Error al publicar')

      toast.success('Reply published')
      setReplyText('')
      setReplyMedia(null)
      replyIdempotencyKeyRef.current = null

      // Recargar replies
      const repliesRes = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`)
      const data = await repliesRes.json()
      setReplies(data.replies || [])
    } catch (error) {
      toast.error('Error publishing reply')
    } finally {
      setIsSendingReply(false)
    }
  }

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

  const handleLike = async () => {
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1)

    try {
      const res = await fetch('/api/feed/reaction', {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: cast.hash, reactionType: 'like' }),
      })
      if (!res.ok) {
        // Revertir si falla
        setIsLiked(wasLiked)
        setLikesCount(prev => wasLiked ? prev + 1 : prev - 1)
      }
    } catch {
      setIsLiked(wasLiked)
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1)
    }
  }

  const handleRecast = async () => {
    const wasRecasted = isRecasted
    setIsRecasted(!wasRecasted)
    setRecastsCount(prev => wasRecasted ? prev - 1 : prev + 1)

    try {
      const res = await fetch('/api/feed/reaction', {
        method: wasRecasted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: cast.hash, reactionType: 'recast' }),
      })
      if (!res.ok) {
        // Revertir si falla
        setIsRecasted(wasRecasted)
        setRecastsCount(prev => wasRecasted ? prev + 1 : prev - 1)
      }
    } catch {
      setIsRecasted(wasRecasted)
      setRecastsCount(prev => wasRecasted ? prev + 1 : prev - 1)
    }
  }

  const handleQuote = () => {
    setShowRecastMenu(false)
    if (onQuote) {
      onQuote(castUrl)
    } else {
      navigator.clipboard.writeText(castUrl)
      toast.success('URL copied. Paste it in composer to quote.')
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

  const handleLightboxPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!lightbox) return
    if (lightbox.urls.length <= 1) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    lightboxDragStartRef.current = { x: e.clientX, y: e.clientY }
    lightboxDragDeltaRef.current = { x: 0, y: 0 }
    lightboxDidSwipeRef.current = false
  }

  const handleLightboxPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const start = lightboxDragStartRef.current
    if (!start) return
    lightboxDragDeltaRef.current = { x: e.clientX - start.x, y: e.clientY - start.y }
  }

  const handleLightboxPointerEnd = () => {
    const start = lightboxDragStartRef.current
    if (!start) return

    const { x: deltaX, y: deltaY } = lightboxDragDeltaRef.current
    lightboxDragStartRef.current = null
    lightboxDragDeltaRef.current = { x: 0, y: 0 }

    const SWIPE_THRESHOLD_PX = 60
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
    if (Math.abs(deltaX) < Math.abs(deltaY)) return

    lightboxDidSwipeRef.current = true
    if (deltaX > 0) {
      handleLightboxPrev()
      return
    }

    handleLightboxNext()
  }

  useEffect(() => {
    if (!lightbox) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCloseLightbox()
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleLightboxPrev()
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleLightboxNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [lightbox])

  useEffect(() => {
    if (!videoModal) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setVideoModal(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [videoModal])

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
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelectUser?.(cast.author.username)
          }}
          onMouseEnter={() => {
            // Prefetch user profile
            queryClient.prefetchQuery({
              queryKey: ['user', cast.author.username],
              queryFn: () => fetch(`/api/users/${cast.author.username}`).then(res => res.json()),
              staleTime: 5 * 60 * 1000,
            })
          }}
          className="cursor-pointer"
        >
          {cast.author.pfp_url ? (
            <Image
              src={cast.author.pfp_url}
              alt={cast.author.username}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:opacity-80 transition-opacity">
              <span className="text-sm font-medium">
                {cast.author.display_name?.[0] || cast.author.username?.[0] || '?'}
              </span>
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* name [pro?] [in canal?] tiempo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectUser?.(cast.author.username)
                }}
                className="text-[15px] font-semibold hover:underline cursor-pointer"
              >
                {cast.author.display_name || cast.author.username}
              </button>
              {(cast.author.power_badge || cast.author.pro?.status === 'subscribed') && <PowerBadge size={16} />}
              {cast.channel && (
                <>
                  <span className="text-muted-foreground text-sm">in</span>
                  <a
                    href={`https://farcaster.xyz/~/channel/${cast.channel.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    {cast.channel.image_url && (
                      <Image
                        src={cast.channel.image_url}
                        alt=""
                        width={14}
                        height={14}
                        className="w-3.5 h-3.5 rounded-full"
                        unoptimized
                      />
                    )}
                    <span>{cast.channel.name || cast.channel.id}</span>
                  </a>
                </>
              )}
              <span className="text-muted-foreground text-sm">{timeAgo}</span>
            </div>
          </div>

          <Popover open={showMoreMenu} onOpenChange={setShowMoreMenu}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Cast actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="end">
              <button
                onClick={handleCopyCastHash}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copy cast hash</span>
              </button>
              {isOwnCast ? (
                onDelete ? (
                  <button
                    onClick={async () => {
                      await handleDelete()
                      setShowMoreMenu(false)
                    }}
                    disabled={isDeleting}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-destructive"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>Delete cast</span>
                  </button>
                ) : null
              ) : (
                <>
                  <button
                    onClick={handleMuteUser}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  >
                    <VolumeX className="w-4 h-4" />
                    <span>Mute user</span>
                  </button>
                  <button
                    onClick={handleBlockUser}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Block user</span>
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

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
                onMentionClick: handleSelectUser,
                onChannelClick: handleSelectChannel,
                onTickerClick: openTicker,
              },
            })}
          />

          {/* Botón ver más/menos */}
          {needsTruncation && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFullText(!showFullText)
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
        </div>

        {/* Embeds (images, videos, frames, links, quote casts) */}
        {cast.embeds && cast.embeds.length > 0 && (() => {
          // Helpers para detectar por URL cuando no hay metadata
          const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url)
          const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url) ||
            url.includes('stream.warpcast.com') || url.includes('stream.farcaster.xyz') || url.includes('cloudflarestream.com')

          const images = cast.embeds.filter(e => e.url && (
            e.metadata?.content_type?.startsWith('image/') ||
            (!e.metadata?.content_type && isImageUrl(e.url))
          ))
          const videos = cast.embeds.filter(e => e.url && (
            e.metadata?.content_type?.startsWith('video/') ||
            e.metadata?.content_type === 'application/vnd.apple.mpegurl' ||
            e.metadata?.content_type === 'application/x-mpegURL' ||
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
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                unoptimized
                              />
                            ) : (
                              <img
                                src={item.image}
                                srcSet={generateSrcSet(item.image)}
                                sizes={SIZES_CAROUSEL}
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
                            setLightbox({ urls, index: clampedIndex })
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
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                              unoptimized
                            />
                          ) : (
                            <img
                              src={item.url}
                              srcSet={generateSrcSet(item.url)}
                              sizes={SIZES_CAROUSEL}
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
                          setShowAllImages(true)
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
                          setShowAllImages(false)
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
                            unoptimized
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
                          setShowAllImages(true)
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
                          setShowAllImages(false)
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

      {/* Actions - distributed across width */}
      <div className="mt-3 ml-0 sm:ml-13 flex items-center justify-between text-sm" onClick={(e) => e.stopPropagation()}>
        {/* Like */}
        <button
          onClick={handleLike}
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
            isLiked
              ? "text-pink-500"
              : "text-muted-foreground hover:text-pink-500"
          )}
        >
          <Heart className={cn("w-4 h-4 transition-transform group-active:scale-125", isLiked && "fill-current")} />
          <span className="text-xs">{likesCount}</span>
        </button>

        {/* Recast */}
        <Popover open={showRecastMenu} onOpenChange={setShowRecastMenu}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
                isRecasted
                  ? "text-green-500"
                  : "text-muted-foreground hover:text-green-500"
              )}
            >
              <Repeat2 className={cn("w-4 h-4 transition-transform group-active:scale-125", isRecasted && "fill-current")} />
              <span className="text-xs">{recastsCount}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <button
              onClick={() => { handleRecast(); setShowRecastMenu(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <Repeat2 className="w-4 h-4" />
              <span>Recast</span>
            </button>
            <button
              onClick={handleQuote}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <Quote className="w-4 h-4" />
              <span>Quote</span>
            </button>
          </PopoverContent>
        </Popover>

        {/* Reply */}
        <button
          onClick={(e) => {
            if (onOpenCast) {
              handleToggleReplies(e)
              return
            }

            if (onReply) {
              e.stopPropagation()
              onReply(cast)
              return
            }

            handleToggleReplies(e)
          }}
          onMouseEnter={() => {
            // Prefetch replies
            queryClient.prefetchQuery({
              queryKey: ['replies', cast.hash],
              queryFn: () => fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`).then(res => res.json()),
              staleTime: 60 * 1000,
            })
          }}
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
            isExpanded
              ? "text-blue-500"
              : "text-muted-foreground hover:text-blue-500"
          )}
        >
          <MessageCircle className="w-4 h-4 transition-transform group-active:scale-125" />
          <span className="text-xs">{loadingReplies ? '...' : cast.replies.count}</span>
        </button>

        {/* Translate */}
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className={cn(
            "group flex items-center px-2 py-1.5 rounded-md transition-colors",
            showTranslation
              ? "text-blue-500"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Traducir"
        >
          {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        </button>

        {/* Share - último */}
        <button
          onClick={handleShare}
          className="group flex items-center px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Compartir"
        >
          <Share className="w-4 h-4" />
        </button>
      </div>

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
                          className="w-6 h-6 rounded-full hover:opacity-80 object-cover mt-0.5"
                          unoptimized
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
                                className="h-24 w-auto rounded-lg object-cover border border-border"
                                unoptimized
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

      {/* Modal de video */}
      {videoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reproductor de video"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setVideoModal(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setVideoModal(null)
            }}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-8 h-8" />
          </button>
          <div
            className="w-full max-w-4xl bg-black rounded-xl overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <HLSVideo
              src={videoModal.url}
              poster={videoModal.poster}
              className="max-h-[80vh] w-full h-auto object-contain"
            />
          </div>
        </div>
      )}

      {/* Lightbox para imágenes */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visor de imágenes"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => {
            if (lightboxDidSwipeRef.current) {
              lightboxDidSwipeRef.current = false
              return
            }

            handleCloseLightbox()
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCloseLightbox()
            }}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-8 h-8" />
          </button>

          {lightbox.urls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleLightboxPrev()
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {lightbox.urls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleLightboxNext()
              }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs font-medium bg-black/30 px-2 py-1 rounded">
              {lightbox.index + 1} / {lightbox.urls.length}
            </div>
          )}

          <img
            src={lightbox.urls[lightbox.index]}
            alt=""
            className="max-w-full max-h-full object-contain touch-none select-none"
            draggable={false}
            onPointerDown={(e) => {
              e.stopPropagation()
              handleLightboxPointerDown(e)
            }}
            onPointerMove={(e) => {
              e.stopPropagation()
              handleLightboxPointerMove(e)
            }}
            onPointerUp={(e) => {
              e.stopPropagation()
              handleLightboxPointerEnd()
            }}
            onPointerCancel={(e) => {
              e.stopPropagation()
              handleLightboxPointerEnd()
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (lightboxDidSwipeRef.current) {
                lightboxDidSwipeRef.current = false
              }
            }}
          />
        </div>
      )}

      {/* AI Reply Dialog */}
      {aiReplyTarget && (
        <AIReplyDialog
          cast={aiReplyTarget}
          open={showAIPicker}
          onOpenChange={(open) => {
            setShowAIPicker(open)
            if (!open) setAiReplyTarget(null)
          }}
          onPublish={handleAIPublish}
          maxChars={isPro ? 10000 : 1024}
        />
      )}
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export const CastCard = memo(CastCardComponent, (prevProps, nextProps) => {
  // Only re-render if cast hash changes (most important)
  // or if callback props change (less common)
  return prevProps.cast.hash === nextProps.cast.hash &&
    prevProps.currentUserFid === nextProps.currentUserFid &&
    prevProps.isPro === nextProps.isPro
})
