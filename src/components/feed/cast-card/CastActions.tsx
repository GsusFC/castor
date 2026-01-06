'use client'

import { memo, useState, useCallback } from 'react'
import { Heart, Repeat2, MessageCircle, Globe, Share, Loader2, Quote } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Cast } from './types'

interface CastActionsProps {
  cast: Cast
  isExpanded: boolean
  loadingReplies: boolean
  showTranslation: boolean
  isTranslating: boolean
  onToggleReplies: (e?: React.MouseEvent) => void
  onReply?: (cast: Cast) => void
  onOpenCast?: (hash: string) => void
  onQuote?: (url: string) => void
  onTranslate: () => void
  onShare: () => void
}

function CastActionsComponent({
  cast,
  isExpanded,
  loadingReplies,
  showTranslation,
  isTranslating,
  onToggleReplies,
  onReply,
  onOpenCast,
  onQuote,
  onTranslate,
  onShare,
}: CastActionsProps) {
  const queryClient = useQueryClient()

  // Local state for optimistic UI
  const [isLiked, setIsLiked] = useState(false)
  const [isRecasted, setIsRecasted] = useState(false)
  const [likesCount, setLikesCount] = useState(cast.reactions.likes_count)
  const [recastsCount, setRecastsCount] = useState(cast.reactions.recasts_count)
  const [showRecastMenu, setShowRecastMenu] = useState(false)

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    const newIsLiked = !isLiked
    const newCount = newIsLiked ? likesCount + 1 : Math.max(0, likesCount - 1)

    // Optimistic update
    setIsLiked(newIsLiked)
    setLikesCount(newCount)

    try {
      const res = await fetch('/api/feed/reaction', {
        method: newIsLiked ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: cast.hash, reactionType: 'like' }),
      })

      if (!res.ok) throw new Error('Failed to update like')
    } catch (error) {
      // Revert on error
      setIsLiked(!newIsLiked)
      setLikesCount(newIsLiked ? newCount - 1 : newCount + 1)
      toast.error('Failed to update like')
    }
  }, [isLiked, likesCount, cast.hash])

  const handleRecast = useCallback(async () => {
    const newIsRecasted = !isRecasted
    const newCount = newIsRecasted ? recastsCount + 1 : Math.max(0, recastsCount - 1)

    // Optimistic update
    setIsRecasted(newIsRecasted)
    setRecastsCount(newCount)

    try {
      const res = await fetch('/api/feed/reaction', {
        method: newIsRecasted ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: cast.hash, reactionType: 'recast' }),
      })

      if (!res.ok) throw new Error('Failed to update recast')
    } catch (error) {
      // Revert on error
      setIsRecasted(!newIsRecasted)
      setRecastsCount(newIsRecasted ? newCount - 1 : newCount + 1)
      toast.error('Failed to update recast')
    }
  }, [isRecasted, recastsCount, cast.hash])

  const handleQuote = useCallback(() => {
    const castUrl = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`
    if (onQuote) {
      onQuote(castUrl)
    } else {
      navigator.clipboard.writeText(castUrl)
      toast.success('Cast URL copied to clipboard')
    }
    setShowRecastMenu(false)
  }, [cast, onQuote])

  const handleReplyClick = useCallback((e: React.MouseEvent) => {
    if (onOpenCast) {
      onToggleReplies(e)
      return
    }

    if (onReply) {
      e.stopPropagation()
      onReply(cast)
      return
    }

    onToggleReplies(e)
  }, [onOpenCast, onReply, onToggleReplies, cast])

  return (
    <div className="mt-3 ml-0 sm:ml-13 flex items-center justify-between text-sm">
      <div className="flex items-center gap-1">
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
          onClick={handleReplyClick}
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
          onClick={onTranslate}
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

        {/* Share */}
        <button
          onClick={onShare}
          className="group flex items-center px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Compartir"
        >
          <Share className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export const CastActions = memo(CastActionsComponent)
