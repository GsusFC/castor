'use client'

import dynamic from 'next/dynamic'
import { memo } from 'react'
import { cn } from '@/lib/utils'
import {
  CastHeader,
  CastActions,
  CastContent,
  CastReplies,
  useCastCard,
} from './cast-card'

const ImageLightbox = dynamic(() => import('./cast-card/ImageLightbox').then(mod => ({ default: mod.ImageLightbox })), {
  ssr: false,
})

import { MorphText } from '@/components/ui/MorphText'
import { ScrambleText } from '@/components/ui/ScrambleText'
import { renderCastText } from '@/lib/cast-text'
import { useTickerDrawer } from '@/context/TickerDrawerContext'
import { generateSrcSet, SIZES_CAROUSEL } from '@/lib/image-utils'

const AIReplyDialog = dynamic(() => import('./AIReplyDialog').then(mod => ({ default: mod.AIReplyDialog })), {
  ssr: false,
})

const MAX_TEXT_LENGTH = 280

const CastCardComponent = function CastCard(props: any) {
  const castCard = useCastCard(props)

  const {
    cast,
    onOpenMiniApp,
    onOpenCast,
    onQuote,
    onDelete,
    onReply,
    onSelectUser,
    isPro = false,
  } = props

  const {
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
    cardRef,
    fileInputRef,
    textareaRef,
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
    readFidListFromStorage,
    writeFidListToStorage,
    openTicker,
  } = castCard

  const needsTruncation = cast.text.length > MAX_TEXT_LENGTH
  const displayText = showFullText || !needsTruncation
    ? cast.text
    : cast.text.slice(0, MAX_TEXT_LENGTH) + '...'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isOwnCast = props.currentUserFids && props.currentUserFids.length > 0
    ? props.currentUserFids.includes(cast.author.fid)
    : props.currentUserFid === cast.author.fid

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
      <CastHeader
        cast={cast}
        isOwnCast={isOwnCast}
        isDeleting={isDeleting}
        showMoreMenu={showMoreMenu}
        setShowMoreMenu={setShowMoreMenu}
        onSelectUser={handleSelectUser}
        onCopyCastHash={handleCopyCastHash}
        onMuteUser={handleMuteUser}
        onBlockUser={handleBlockUser}
        onDelete={handleDelete}
      />

      <CastContent
        cast={cast}
        showTranslation={showTranslation}
        translation={translation}
        displayText={displayText}
        needsTruncation={needsTruncation}
        showFullText={showFullText}
        showAllImages={showAllImages}
        setShowFullText={setShowFullText}
        setShowAllImages={setShowAllImages}
        onOpenCast={handleOpenCast}
        onOpenCastKeyDown={handleOpenCastKeyDown}
        onSelectUser={handleSelectUser}
        onSelectChannel={handleSelectChannel}
        onOpenMiniApp={onOpenMiniApp}
        onOpenTicker={openTicker}
        onOpenLightbox={setLightbox}
      />

      <CastActions
        cast={cast}
        isExpanded={isExpanded}
        loadingReplies={loadingReplies}
        showTranslation={showTranslation}
        isTranslating={isTranslating}
        isLiked={isLiked}
        isRecasted={isRecasted}
        likesCount={likesCount}
        recastsCount={recastsCount}
        showRecastMenu={showRecastMenu}
        onToggleReplies={handleToggleReplies}
        onReply={onReply}
        onOpenCast={onOpenCast}
        onQuote={handleQuote}
        onTranslate={handleTranslate}
        onShare={handleShare}
        onLike={handleLike}
        onRecast={handleRecast}
      />

      <CastReplies
        cast={cast}
        isExpanded={isExpanded}
        loadingReplies={loadingReplies}
        replies={replies}
        onReply={onReply}
        onOpenCast={onOpenCast}
      />

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
        <ImageLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={handleCloseLightbox}
          onPrev={handleLightboxPrev}
          onNext={handleLightboxNext}
          onPointerDown={handleLightboxPointerDown}
          onPointerMove={handleLightboxPointerMove}
          onPointerEnd={handleLightboxPointerEnd}
        />
      )}

      {showAIPicker && cast && (
        <AIReplyDialog
          cast={cast}
          open={showAIPicker}
          onOpenChange={(open) => {
            setShowAIPicker(open)
            if (!open) setShowGifPicker(false)
          }}
          onPublish={(text) => setReplyText(text)}
          maxChars={isPro ? 10000 : 1024}
        />
      )}
    </div>
  )
}

export const CastCard = memo(CastCardComponent)
