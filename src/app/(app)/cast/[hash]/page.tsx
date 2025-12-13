'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import { CastCard } from '@/components/feed/CastCard'
import { cn } from '@/lib/utils'

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

export default function CastPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)
  const router = useRouter()

  const { data, isLoading, error } = useQuery<ConversationResponse>({
    queryKey: ['conversation', hash],
    queryFn: async () => {
      const response = await fetch(`/api/casts/${encodeURIComponent(hash)}/conversation`)
      if (!response.ok) throw new Error('Failed to fetch conversation')
      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const handleSelectUser = (username: string) => {
    router.push(`/user/${username}`)
  }

  const handleCastClick = (castHash: string) => {
    router.push(`/cast/${castHash}`)
  }

  const thread = data?.thread ?? []
  const mainCast = thread.length > 0 ? thread[thread.length - 1] : null
  const parentCast = thread.length > 1 ? thread[thread.length - 2] : null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Conversación</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto">
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
        ) : data && mainCast ? (
          <div className="divide-y divide-border">
            {/* Parent cast (si existe) */}
            {parentCast && (
              <div className="relative">
                <div
                  onClick={() => handleCastClick(parentCast.hash)}
                  className="w-full text-left cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                >
                  <CastCard
                    cast={parentCast}
                    onSelectUser={handleSelectUser}
                  />
                </div>
                {/* Thread line */}
                <div className="absolute left-[30px] top-[56px] bottom-0 w-0.5 bg-border" />
              </div>
            )}

            {/* Main cast (highlighted) */}
            <div className={cn(
              "bg-muted/30",
              parentCast && "border-l-2 border-primary"
            )}>
              <CastCard
                cast={mainCast}
                onSelectUser={handleSelectUser}
              />
            </div>

            {/* Replies section */}
            {data.replies.casts.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <MessageCircle className="w-4 h-4" />
                  <span>{data.replies.casts.length} respuesta{data.replies.casts.length !== 1 && 's'}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {data.replies.casts.map((reply) => (
                    <div
                      key={reply.hash}
                      onClick={() => handleCastClick(reply.hash)}
                      className="w-full text-left hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <CastCard
                        cast={reply}
                        onSelectUser={handleSelectUser}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No replies message */}
            {data.replies.casts.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aún no hay respuestas</p>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
