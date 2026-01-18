'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTickerDrawer } from '@/context/TickerDrawerContext'
import { CastHeader } from './cast-card/CastHeader'
import { CastActions } from './cast-card/CastActions'
import { CastContent } from './cast-card/CastContent'
import { CastReplies } from './cast-card/CastReplies'
import {
  BLOCKED_FIDS_STORAGE_KEY,
  MUTED_FIDS_STORAGE_KEY,
  MAX_TEXT_LENGTH,
} from './cast-card/constants'
import { readFidListFromStorage, writeFidListToStorage } from './cast-card/utils'
import type { Cast, CastCardProps } from './cast-card/types'

// Lazy load modals
const ImageLightbox = dynamic(() => import('./cast-card/ImageLightbox').then(mod => ({ default: mod.ImageLightbox })), {
  ssr: false,
})

const VideoModal = dynamic(() => import('./cast-card/VideoModal').then(mod => ({ default: mod.VideoModal })), {
  ssr: false,
})

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
    const next = Array.from(new Set([...current, fid]))
    writeFidListToStorage(MUTED_FIDS_STORAGE_KEY, next)
    toast.success(`Muted @${cast.author.username}`)
    setShowMoreMenu(false)
  }, [cast.author.fid, cast.author.username, currentUserFid])

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
    const next = Array.from(new Set([...current, fid]))
    writeFidListToStorage(BLOCKED_FIDS_STORAGE_KEY, next)
    toast.success(`Blocked @${cast.author.username}`)
    setShowMoreMenu(false)
  }, [cast.author.fid, cast.author.username, currentUserFid])

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

      {/* Replies Section */}
      <CastReplies
        cast={cast}
        isExpanded={isExpanded}
        loadingReplies={loadingReplies}
        replies={replies}
        onReply={onReply}
        onOpenCast={onOpenCast}
      />

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
