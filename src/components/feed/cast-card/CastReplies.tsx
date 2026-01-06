'use client'

import { memo } from 'react'
import Image from 'next/image'
import { Loader2, Heart, Repeat2, MessageCircle, Share } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { UserPopover } from '@/components/feed/UserPopover'
import { getShortTimeAgo } from './utils'
import type { Cast } from './types'

interface Reply {
  hash: string
  text: string
  timestamp: string
  author?: {
    fid: number
    username: string
    display_name: string
    pfp_url?: string
  }
  embeds?: any[]
  reactions?: {
    likes_count: number
    recasts_count: number
  }
}

interface CastRepliesProps {
  cast: Cast
  isExpanded: boolean
  loadingReplies: boolean
  replies: Reply[]
  onReply?: (cast: Cast) => void
  onOpenCast?: (castHash: string) => void
}

function CastRepliesComponent({
  cast,
  isExpanded,
  loadingReplies,
  replies,
  onReply,
  onOpenCast,
}: CastRepliesProps) {
  if (!isExpanded) return null

  return (
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
                        onReply?.({
                          hash: reply.hash,
                          text: reply.text,
                          timestamp: reply.timestamp,
                          author: {
                            fid: reply.author?.fid || 0,
                            username: reply.author?.username || '',
                            display_name: reply.author?.display_name || '',
                          },
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
  )
}

export const CastReplies = memo(CastRepliesComponent)
