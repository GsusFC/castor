'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { CastCard } from '@/components/feed/CastCard'
import { cn } from '@/lib/utils'

interface ConversationViewProps {
  castHash: string
  onBack: () => void
  onSelectUser: (username: string) => void
  onSelectCast?: (hash: string) => void
  onQuote?: (text: string) => void
  onReply?: (cast: { hash: string; author: { username: string; fid: number } }) => void
  onOpenComposer?: () => void
  userPfp?: string
}

interface ConversationResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thread: any[]
  targetHash: string
  replies: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  onReply,
  onOpenComposer,
  userPfp,
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

  // El último cast del thread es el target (al que respondemos)
  const targetCast = data?.thread[data.thread.length - 1]

  const handleReplyClick = () => {
    if (targetCast && onReply) {
      onReply({
        hash: targetCast.hash,
        author: {
          username: targetCast.author.username,
          fid: targetCast.author.fid,
        }
      })
    }
  }

  // Handler genérico para reply a cualquier cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCastReply = (cast: any) => {
    if (onReply) {
      onReply({
        hash: cast.hash,
        author: {
          username: cast.author.username,
          fid: cast.author.fid,
        }
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold">Conversación</h1>
          </div>
          {onOpenComposer && (
            <button
              onClick={onOpenComposer}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Cast
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-muted-foreground mb-4">No se pudo cargar el cast</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : data ? (
          <div className="pt-3 pb-4">
            {/* Thread lineal completo */}
            {data.thread.map((cast, index) => {
              const isTarget = cast.hash === data.targetHash
              const isLast = index === data.thread.length - 1
              
              return (
                <div key={cast.hash}>
                  <div
                    onClick={() => !isTarget && handleCastClick(cast.hash)}
                    className={cn(
                      "mx-3 rounded-xl border",
                      isTarget 
                        ? "bg-muted/30 border-primary/40" 
                        : "border-border/50 cursor-pointer hover:bg-muted/20 transition-colors"
                    )}
                  >
                    <CastCard
                      cast={cast}
                      onSelectUser={onSelectUser}
                      onReply={() => handleCastReply(cast)}
                    />
                  </div>
                  {/* Línea conectora bajo el avatar */}
                  {!isLast && (
                    <div className="ml-[3.1rem] py-1">
                      <div className="w-0.5 h-4 bg-border" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Replies */}
            {data.replies.casts.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border mx-3">
                <p className="text-sm text-muted-foreground mb-3">Respuestas</p>
                {data.replies.casts.map((reply, index) => (
                  <div
                    key={reply.hash}
                    onClick={() => handleCastClick(reply.hash)}
                    className={cn(
                      "rounded-xl border border-border/50 cursor-pointer hover:bg-muted/20 transition-colors",
                      index > 0 && "mt-3"
                    )}
                  >
                    <CastCard
                      cast={reply}
                      onSelectUser={onSelectUser}
                      onReply={() => handleCastReply(reply)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Reply input fijo abajo */}
      {data && (
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            {userPfp ? (
              <img src={userPfp} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted" />
            )}
            <button
              onClick={handleReplyClick}
              className="flex-1 text-left px-4 py-2 bg-muted/50 hover:bg-muted rounded-full text-muted-foreground text-sm transition-colors"
            >
              Cast your reply
            </button>
            <button
              onClick={handleReplyClick}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
