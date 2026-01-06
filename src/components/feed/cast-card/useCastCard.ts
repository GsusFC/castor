'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTickerDrawer } from '@/context/TickerDrawerContext'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { uploadMedia } from '@/lib/media-upload'
import { ApiRequestError } from '@/lib/fetch-json'
import { toast } from 'sonner'
import type { Cast, CastCardProps } from './types'
import type { ImageLightbox, VideoModal } from './types'

export function useCastCard(props: CastCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { openTicker } = useTickerDrawer()
  const { selectedAccountId } = useSelectedAccount()

  const { cast, onOpenMiniApp, onOpenCast, onQuote, onDelete, onReply, onSelectUser } = props

  // Translation state
  const [translation, setTranslation] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)

  // Reactions state
  const [isLiked, setIsLiked] = useState(false)
  const [isRecasted, setIsRecasted] = useState(false)
  const [likesCount, setLikesCount] = useState(cast.reactions.likes_count)
  const [recastsCount, setRecastsCount] = useState(cast.reactions.recasts_count)

  // Modals state
  const [lightbox, setLightbox] = useState<ImageLightbox | null>(null)
  const [videoModal, setVideoModal] = useState<VideoModal | null>(null)
  const [showAllImages, setShowAllImages] = useState(false)

  // Replies state
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Reply composer state
  const [replyText, setReplyText] = useState('')
  const [replyMedia, setReplyMedia] = useState<{ preview: string; url?: string; uploading: boolean; isGif?: boolean } | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showAIPicker, setShowAIPicker] = useState(false)

  const replyIdempotencyKeyRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    replyIdempotencyKeyRef.current = null
  }, [replyText, replyMedia?.url])

  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)

  // Moderation menu
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showRecastMenu, setShowRecastMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFullText, setShowFullText] = useState(false)

  // Lightbox drag handling
  const lightboxDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lightboxDragDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lightboxDidSwipeRef = useRef(false)

  // Read/write fid lists from localStorage
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

  // Copy cast hash
  const handleCopyCastHash = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(cast.hash)
      toast.success('Cast hash copied')
      setShowMoreMenu(false)
    } catch {
      toast.error('Copy error')
    }
  }, [cast.hash])

  // Mute user
  const handleMuteUser = useCallback((): void => {
    const fid = cast.author.fid
    if (!Number.isFinite(fid)) return

    const currentUserFid = props.currentUserFid
    if (currentUserFid && fid === currentUserFid) {
      toast.error('You cannot mute yourself')
      return
    }

    const current = readFidListFromStorage('castor:mutedFids')
    writeFidListToStorage('castor:mutedFids', [...current, fid])
    window.dispatchEvent(new Event('castor:moderation-updated'))
    toast.success(`Muted @${cast.author.username}`)
    setShowMoreMenu(false)
  }, [cast.author.fid, cast.author.username, props.currentUserFid, readFidListFromStorage, writeFidListToStorage])

  // Block user
  const handleBlockUser = useCallback((): void => {
    const fid = cast.author.fid
    if (!Number.isFinite(fid)) return

    const currentUserFid = props.currentUserFid
    if (currentUserFid && fid === currentUserFid) {
      toast.error('You cannot block yourself')
      return
    }

    const confirmed = confirm(`Block @${cast.author.username}?`)
    if (!confirmed) return

    const current = readFidListFromStorage('castor:blockedFids')
    writeFidListToStorage('castor:blockedFids', [...current, fid])
    window.dispatchEvent(new Event('castor:moderation-updated'))
    toast.success(`Blocked @${cast.author.username}`)
    setShowMoreMenu(false)
  }, [cast.author.fid, cast.author.username, props.currentUserFid, readFidListFromStorage, writeFidListToStorage])

  // Close on click outside
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [replyText])

  // Toggle replies
  const handleToggleReplies = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (isExpanded) {
      setIsExpanded(false)
      return
    }

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
  }, [isExpanded, replies.length, cast.replies.count, cast.hash])

  // Delete cast
  const handleDelete = useCallback(async () => {
    if (!onDelete || isDeleting) return

    if (!confirm('Are you sure you want to delete this cast?')) return

    setIsDeleting(true)
    try {
      onDelete(cast.hash)
    } finally {
      setIsDeleting(false)
    }
  }, [onDelete, isDeleting, cast.hash])

  // Translate cast
  const handleTranslate = useCallback(async () => {
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
  }, [translation, showTranslation, cast.text])

  // Share cast
  const handleShare = useCallback(async () => {
    const url = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Copy error')
    }
  }, [cast.author.username, cast.hash])

  // Like cast
  const handleLike = useCallback(async () => {
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
        setIsLiked(wasLiked)
        setLikesCount(prev => wasLiked ? prev + 1 : prev - 1)
      }
    } catch {
      setIsLiked(wasLiked)
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1)
    }
  }, [isLiked, cast.hash])

  // Recast cast
  const handleRecast = useCallback(async () => {
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
        setIsRecasted(wasRecasted)
        setRecastsCount(prev => wasRecasted ? prev + 1 : prev - 1)
      }
    } catch {
      setIsRecasted(wasRecasted)
      setRecastsCount(prev => wasRecasted ? prev + 1 : prev - 1)
    }
  }, [isRecasted, cast.hash])

  // Quote cast
  const handleQuote = useCallback(() => {
    setShowRecastMenu(false)
    if (onQuote) {
      const url = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`
      onQuote(url)
    } else {
      const url = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`
      navigator.clipboard.writeText(url)
      toast.success('URL copied. Paste it in composer to quote.')
    }
  }, [onQuote, cast.author.username, cast.hash])

  // Select user
  const handleSelectUser = useCallback((username: string) => {
    if (onSelectUser) {
      onSelectUser(username)
      return
    }
    const qs = new URLSearchParams()
    qs.set('user', username)
    router.push(`/?${qs.toString()}`)
  }, [onSelectUser, router])

  // Select channel
  const handleSelectChannel = useCallback((channelId: string) => {
    const qs = new URLSearchParams()
    qs.set('channel', channelId)
    router.push(`/?${qs.toString()}`)
  }, [router])

  // Open cast
  const handleOpenCast = useCallback(() => {
    onOpenCast?.(cast.hash)
  }, [onOpenCast, cast.hash])

  // Handle cast keydown
  const handleOpenCastKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenCast) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleOpenCast()
  }, [onOpenCast, handleOpenCast])

  // Handle lightbox close
  const handleCloseLightbox = useCallback(() => {
    setLightbox(null)
  }, [])

  // Handle lightbox prev
  const handleLightboxPrev = useCallback(() => {
    setLightbox((current) => {
      if (!current) return current
      if (current.urls.length <= 1) return current
      const nextIndex = (current.index - 1 + current.urls.length) % current.urls.length
      return { ...current, index: nextIndex }
    })
  }, [])

  // Handle lightbox next
  const handleLightboxNext = useCallback(() => {
    setLightbox((current) => {
      if (!current) return current
      if (current.urls.length <= 1) return current
      const nextIndex = (current.index + 1) % current.urls.length
      return { ...current, index: nextIndex }
    })
  }, [])

  // Handle lightbox drag
  const handleLightboxPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!lightbox) return
    if (lightbox.urls.length <= 1) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    lightboxDragStartRef.current = { x: e.clientX, y: e.clientY }
    lightboxDragDeltaRef.current = { x: 0, y: 0 }
    lightboxDidSwipeRef.current = false
  }, [lightbox])

  const handleLightboxPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const start = lightboxDragStartRef.current
    if (!start) return
    lightboxDragDeltaRef.current = { x: e.clientX - start.x, y: e.clientY - start.y }
  }, [])

  const handleLightboxPointerEnd = useCallback(() => {
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
  }, [handleLightboxPrev, handleLightboxNext])

  // Lightbox keyboard
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
  }, [lightbox, handleCloseLightbox, handleLightboxPrev, handleLightboxNext])

  // Video modal keyboard
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

  // Upload image for reply
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Only images allowed')
      return
    }

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

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Select GIF
  const handleGifSelect = useCallback((gifUrl: string) => {
    setReplyMedia({ preview: gifUrl, url: gifUrl, uploading: false, isGif: true })
    setShowGifPicker(false)
  }, [])

  // Send reply
  const handleSendReply = useCallback(async () => {
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

      const repliesRes = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`)
      const data = await repliesRes.json()
      setReplies(data.replies || [])
    } catch (error) {
      toast.error('Error publishing reply')
    } finally {
      setIsSendingReply(false)
    }
  }, [replyText, replyMedia, isSendingReply, selectedAccountId, cast.hash])

  // Translate reply
  const handleTranslateReply = useCallback(async () => {
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
  }, [replyText])

  return {
    // State
    translation,
    isTranslating,
    showTranslation,
    setShowTranslation,
    isLiked,
    isRecasted,
    likesCount,
    setLikesCount,
    setRecastsCount,
    lightbox,
    setLightbox,
    videoModal,
    setVideoModal,
    showAllImages,
    setShowAllImages,
    replies,
    loadingReplies,
    isExpanded,
    setIsExpanded,
    replyText,
    setReplyText,
    replyMedia,
    setReplyMedia,
    showGifPicker,
    setShowGifPicker,
    showAIPicker,
    setShowAIPicker,
    showMoreMenu,
    setShowMoreMenu,
    showRecastMenu,
    setShowRecastMenu,
    isDeleting,
    isSendingReply,
    isTranslatingReply,
    showFullText,
    setShowFullText,

    // Refs
    cardRef,
    fileInputRef,
    textareaRef,

    // Handlers
    handleCopyCastHash,
    handleMuteUser,
    handleBlockUser,
    handleToggleReplies,
    handleDelete,
    handleTranslate,
    handleShare,
    handleLike,
    handleRecast,
    handleQuote,
    handleSelectUser,
    handleSelectChannel,
    handleOpenCast,
    handleOpenCastKeyDown,
    handleCloseLightbox,
    handleLightboxPrev,
    handleLightboxNext,
    handleLightboxPointerDown,
    handleLightboxPointerMove,
    handleLightboxPointerEnd,
    handleImageUpload,
    handleGifSelect,
    handleSendReply,
    handleTranslateReply,

    // Helpers
    readFidListFromStorage,
    writeFidListToStorage,
    openTicker,
  }
}
