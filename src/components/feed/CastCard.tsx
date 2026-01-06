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

const VideoModal = dynamic(() => import('./cast-card/VideoModal').then(mod => ({ default: mod.VideoModal })), {
  ssr: false,
})

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

  const isOwnCast = props.currentUserFids && props.currentUserFids.length > 0
    ? props.currentUserFids.includes(cast.author.fid)
    : props.currentUserFid === cast.author.fid

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
