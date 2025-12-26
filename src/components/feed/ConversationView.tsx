'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { CastCard } from '@/components/feed/CastCard'
import { ViewHeader } from '@/components/ui/ViewHeader'
import { cn } from '@/lib/utils'

interface ConversationViewProps {
  castHash: string
  onBack: () => void
  onSelectUser: (username: string) => void
  onSelectCast?: (hash: string) => void
  onQuote?: (text: string) => void
  currentUserFid?: number
  currentUserFids?: number[]
  onDelete?: (castHash: string) => void
}

interface ConversationResponse {
  thread: any[]
  targetHash: string
  replies: {
    casts: any[]
    cursor: string | null
    hasMore: boolean
  }
}

export function ConversationView({
  castHash,
  onBack,
  onSelectUser,
  onSelectCast,
  onQuote,
  currentUserFid,
  currentUserFids,
  onDelete,
}: ConversationViewProps) {
  const { data, isLoading, error } = useQuery<ConversationResponse>({
    queryKey: ['conversation', castHash],
    queryFn: async () => {
      const response = await fetch(`/api/casts/${encodeURIComponent(castHash)}/conversation`)
      if (!response.ok) throw new Error('Failed to fetch conversation')
      return response.json()
    },
    staleTime: 1000 * 60 * 5,
  })

  const handleCastClick = (hash: string) => {
    if (onSelectCast) {
      onSelectCast(hash)
    }
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto">
      <ViewHeader
        title="Conversation"
        onBack={onBack}
      />

      {/* Content */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-muted-foreground mb-4">Could not load conversation</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="py-4">
            {/* Thread lineal completo */}
            <div className="space-y-1">
              {data.thread.map((cast, index) => {
                const isTarget = cast.hash === data.targetHash
                const isLast = index === data.thread.length - 1

                return (
                  <div key={cast.hash}>
                    <div
                      onClick={() => !isTarget && handleCastClick(cast.hash)}
                      className={cn(
                        "rounded-xl border transition-all",
                        isTarget
                          ? "bg-muted/30 border-primary/40 shadow-sm"
                          : "border-border/50 cursor-pointer hover:bg-muted/20"
                      )}
                    >
                      <CastCard
                        cast={cast}
                        onSelectUser={onSelectUser}
                        onQuote={onQuote}
                        currentUserFid={currentUserFid}
                        currentUserFids={currentUserFids}
                        onDelete={onDelete}
                      />
                    </div>
                    {/* Línea conectora bajo el avatar */}
                    {!isLast && (
                      <div className="ml-[3.1rem] py-1">
                        <div className="w-0.5 h-4 bg-border/60" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Replies */}
            {data.replies.casts.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border/50" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Replies</p>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                <div className="space-y-3">
                  {data.replies.casts.map((reply) => (
                    <div
                      key={reply.hash}
                      onClick={() => handleCastClick(reply.hash)}
                      className="rounded-xl border border-border/50 cursor-pointer hover:bg-muted/20 transition-colors"
                    >
                      <CastCard
                        cast={reply}
                        onSelectUser={onSelectUser}
                        onQuote={onQuote}
                        currentUserFid={currentUserFid}
                        currentUserFids={currentUserFids}
                        onDelete={onDelete}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
