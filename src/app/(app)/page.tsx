'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { Virtuoso } from 'react-virtuoso'
import { CastCard } from '@/components/feed/CastCard'
import { MiniAppDrawer } from '@/components/feed/MiniAppDrawer'
import { ChannelHeader } from '@/components/feed/ChannelHeader'
import { RightSidebar } from '@/components/feed/RightSidebar'
import { ConversationView } from '@/components/feed/ConversationView'
import { ProfileView } from '@/components/profile/ProfileView'
import type { ReplyToCast } from '@/components/compose/types'
import { useFeedNavigation } from '@/hooks/useFeedNavigation'
import type { Cast } from '@/components/feed/cast-card'
import {
  MUTED_FIDS_STORAGE_KEY,
  BLOCKED_FIDS_STORAGE_KEY,
  MODERATION_UPDATED_EVENT,
  readFidListFromStorage,
} from '@/components/feed/cast-card'

// Lazy load ComposeModal (561 lines, only needed when composing)
const ComposeModal = dynamic(
  () => import('@/components/compose/ComposeModal').then(mod => ({ default: mod.ComposeModal }))
)
import { cn } from '@/lib/utils'
import { NAV } from '@/lib/spacing-system'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface SelectedChannel {
  id: string
  name: string
  image_url?: string
}

interface UserProfile {
  pfpUrl?: string
  username?: string
}

type MeResponse = {
  fid?: number
  accountId?: string | null
  signerUuid?: string | null
  isPro?: boolean
  manageableFids?: number[]
}

function FeedPageInner() {
  const router = useRouter()
  const {
    activeTab,
    selectedCast,
    selectedUser,
    selectedChannelId,
    setTab,
    openCast,
    openUser,
    closeOverlay,
    clearChannel,
  } = useFeedNavigation()
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)
  const [userSignerUuid, setUserSignerUuid] = useState<string | null>(null)
  const [userIsPro, setUserIsPro] = useState(false)
  const [manageableFids, setManageableFids] = useState<number[] | null>(null)
  const [miniApp, setMiniApp] = useState<{ url: string; title: string } | null>(null)
  const [profile, setProfile] = useState<UserProfile>({})
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(null)

  const [moderationState, setModerationState] = useState<{
    mutedFids: Set<number>
    blockedFids: Set<number>
  }>(() => ({ mutedFids: new Set(), blockedFids: new Set() }))

  useEffect(() => {
    const syncModeration = () => {
      const muted = readFidListFromStorage(MUTED_FIDS_STORAGE_KEY)
      const blocked = readFidListFromStorage(BLOCKED_FIDS_STORAGE_KEY)
      setModerationState({
        mutedFids: new Set(muted),
        blockedFids: new Set(blocked),
      })
    }

    syncModeration()
    window.addEventListener(MODERATION_UPDATED_EVENT, syncModeration)
    window.addEventListener('storage', syncModeration)

    return () => {
      window.removeEventListener(MODERATION_UPDATED_EVENT, syncModeration)
      window.removeEventListener('storage', syncModeration)
    }
  }, [])

  useEffect(() => {
    if (!selectedChannelId) {
      setSelectedChannel(null)
      return
    }

    // Si el canal ya está seleccionado, no hacer nada
    setSelectedChannel(prev => {
      if (prev?.id === selectedChannelId) return prev

      // Fetch channel info async
      fetch(`/api/channels/${selectedChannelId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.channel) {
            setSelectedChannel({
              id: data.channel.id,
              name: data.channel.name,
              image_url: data.channel.image_url,
            })
          }
        })
        .catch(() => {
          setSelectedChannel({ id: selectedChannelId, name: selectedChannelId })
        })

      // Retornar placeholder mientras carga
      return { id: selectedChannelId, name: selectedChannelId }
    })
  }, [selectedChannelId])
  const [composeOpen, setComposeOpen] = useState(false)
  const [quoteContent, setQuoteContent] = useState<string>('')
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)
  const queryClient = useQueryClient()

  const FeedCastSkeleton = () => (
    <div className="p-4 border border-border rounded-xl bg-card animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted/60 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3 w-36 rounded bg-muted/60" />
          <div className="h-3 w-24 rounded bg-muted/50" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-muted/60" />
        <div className="h-3 w-11/12 rounded bg-muted/50" />
        <div className="h-3 w-3/4 rounded bg-muted/50" />
      </div>
      <div className="mt-3 h-40 rounded-xl bg-muted/40" />
    </div>
  )

  // Obtener FID y perfil del usuario logueado
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me')
        const data = (await res.json()) as MeResponse
        if (data.fid) {
          setUserFid(data.fid)
          if (data.accountId) setUserAccountId(data.accountId)
          if (data.signerUuid) setUserSignerUuid(data.signerUuid)
          if (typeof data.isPro === 'boolean') setUserIsPro(data.isPro)
          if (Array.isArray(data.manageableFids)) setManageableFids(data.manageableFids)
          // Cargar perfil completo
          const profileRes = await fetch(`/api/users/${data.fid}`)
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            const user = profileData.user || profileData
            setProfile({
              pfpUrl: user.pfp_url || '',
              username: user.username || '',
            })
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }
    fetchUser()
  }, [])

  const requiresFidForTab = activeTab === 'home' || activeTab === 'following'
  const isWaitingForFid = requiresFidForTab && userFid === null
  const isFeedEnabled = !requiresFidForTab || userFid !== null

  // Feed query - optimized for mobile with cache, retry and larger batches
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', activeTab, userFid, selectedChannelId ?? null] as const,
    queryFn: async ({ queryKey, pageParam }) => {
      const [_key, type, fid, channelId] = queryKey
      const payload: Record<string, unknown> = {
        type,
        limit: 20,
      }
      if (typeof pageParam === 'string') {
        const trimmed = pageParam.trim()
        if (trimmed.length > 0) payload.cursor = trimmed
      }
      if (fid && (type === 'following' || type === 'home')) {
        payload.fid = fid
      }
      if (type === 'channel' && channelId) {
        payload.channel = channelId
      }

      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      return res.json()
    },
    enabled: isFeedEnabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    getNextPageParam: (lastPage) => {
      const cursor = lastPage?.next?.cursor
      if (typeof cursor !== 'string') return undefined
      const trimmed = cursor.trim()
      if (trimmed.length === 0) return undefined
      return trimmed
    },
    initialPageParam: undefined as string | undefined,
  })

  // Flatten and dedupe casts by hash
  const allCasts = feedQuery.data?.pages.flatMap((page) => page.casts) || []
  const casts = allCasts.filter(
    (cast: Cast, index: number, self: Cast[]) =>
      cast?.hash && self.findIndex((c: Cast) => c?.hash === cast.hash) === index
  )

  const filteredCasts = casts.filter((cast) => {
    const fid = cast?.author?.fid
    if (!Number.isFinite(fid)) return true
    if (moderationState.blockedFids.has(fid)) return false
    if (moderationState.mutedFids.has(fid)) return false
    return true
  })

  const isLoading = feedQuery.isLoading || isWaitingForFid
  const isFetchingNextPage = feedQuery.isFetchingNextPage
  const hasMore = isFeedEnabled ? feedQuery.hasNextPage : false

  // Simplified loadMore - Virtuoso handles scroll detection via endReached
  const loadMore = useCallback(() => {
    if (!isFeedEnabled || !hasMore || isLoading || isFetchingNextPage) return
    feedQuery.fetchNextPage()
  }, [feedQuery, hasMore, isFeedEnabled, isFetchingNextPage, isLoading])

  // Handler para Quote - abre composer con URL del cast
  const handleQuote = (castUrl: string) => {
    setQuoteContent(castUrl)
    setComposeOpen(true)
  }

  // Handler para Delete - elimina el cast y refresca feed
  const handleDelete = async (castHash: string) => {
    try {
      const res = await fetch(`/api/feed/cast/${castHash}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Cast eliminado')
        queryClient.invalidateQueries({ queryKey: ['feed'] })
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar cast')
    }
  }

  return (
    <div className="flex gap-8 w-full">
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 max-w-2xl">
        {/* Show Conversation, Profile or Feed */}
        {selectedCast ? (
          <ConversationView
            castHash={selectedCast}
            onBack={() => {
              router.back()
            }}
            onSelectUser={(username) => {
              openUser(username)
            }}
            onSelectCast={(hash) => openCast(hash)}
            onQuote={handleQuote}
            currentUserFid={userFid || undefined}
            currentUserFids={manageableFids || undefined}
            onDelete={handleDelete}
          />
        ) : selectedUser ? (
          <ProfileView
            username={selectedUser}
            onBack={() => closeOverlay()}
            onSelectUser={openUser}
            onOpenCast={(castHash: string) => {
              openCast(castHash)
            }}
            onQuote={handleQuote}
            onReply={(c) => {
              setReplyToCast({
                hash: c.hash,
                text: c.text,
                timestamp: c.timestamp,
                author: {
                  fid: c.author.fid,
                  username: c.author.username,
                  displayName: c.author.display_name,
                  pfpUrl: c.author.pfp_url || null,
                },
              })
              setComposeOpen(true)
            }}
            currentUserFid={userFid || undefined}
            currentUserFids={manageableFids || undefined}
            onDelete={handleDelete}
            isPro={userIsPro}
          />
        ) : (
          <div className="flex flex-col">
            {/* Tabs Header - sticky at top-0 to match ViewHeader consistency */}
            <div className={cn("sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50", NAV.PILL_TABS.containerPadding)}>
              <div className="flex items-center gap-2">
                {/* Avatar/Profile button */}
                <button
                  onClick={() => profile.username && openUser(profile.username)}
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  {profile.pfpUrl ? (
                    <Image
                      src={profile.pfpUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 shrink-0 rounded-full object-cover shadow-sm bg-background border border-border/10"
                    />
                  ) : (
                    <div className="w-10 h-10 shrink-0 rounded-full bg-muted flex items-center justify-center border border-border/10 shadow-sm">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </button>

                {/* Feed tabs */}
                <div className={cn("flex-1 flex items-center", NAV.PILL_TABS.containerBg, NAV.PILL_TABS.containerPadding, NAV.PILL_TABS.gap)}>
                  {([
                    { id: 'home', label: 'Home' },
                    { id: 'following', label: 'Following' },
                    { id: 'trending', label: 'Trending' },
                  ] as { id: 'home' | 'following' | 'trending'; label: string }[]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setTab(tab.id)
                      }}
                      onMouseEnter={() => {
                        if (tab.id === activeTab) return
                        const tabRequiresFid = tab.id === 'following' || tab.id === 'home'
                        if (tabRequiresFid && !userFid) return

                        queryClient.prefetchInfiniteQuery({
                          queryKey: ['feed', tab.id, userFid, null] as const,
                          queryFn: async ({ queryKey }) => {
                            const [_key, type, fid, channelId] = queryKey
                            const payload: Record<string, unknown> = {
                              type,
                              limit: 20,
                            }
                            if ((type === 'following' || type === 'home') && fid) {
                              payload.fid = fid
                            }
                            const r = await fetch('/api/feed', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(payload),
                            })
                            return r.json()
                          },
                          getNextPageParam: (lastPage: any) => {
                            const cursor = lastPage?.next?.cursor
                            if (typeof cursor !== 'string') return undefined
                            const trimmed = cursor.trim()
                            if (trimmed.length === 0) return undefined
                            return trimmed
                          },
                          initialPageParam: undefined as string | undefined,
                          staleTime: 30 * 1000,
                        })
                      }}
                      className={cn(
                        "relative flex-1 text-xs sm:text-sm",
                        NAV.PILL_TABS.pill.base,
                        activeTab === tab.id && activeTab !== 'channel'
                          ? NAV.PILL_TABS.pill.active
                          : NAV.PILL_TABS.pill.inactive
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Canal seleccionado */}
                {selectedChannel && (
                  <button
                    onClick={() => {
                      clearChannel()
                    }}
                    className={cn(NAV.PILL_TABS.pill.base, "text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 ml-1")}
                  >
                    #{selectedChannel.name} ✕
                  </button>
                )}
              </div>
            </div>

            {/* Channel Header */}
            {activeTab === 'channel' && selectedChannel && (
              <ChannelHeader
                channelId={selectedChannel.id}
                onBack={clearChannel}
                signerUuid={userSignerUuid || undefined}
              />
            )}

            {/* Content Feed */}
            <div className={cn(activeTab !== 'channel' ? "mt-4" : "mt-2")}>
              {isLoading ? (
                <div className="space-y-3 sm:space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => <FeedCastSkeleton key={`cast-skel-${i}`} />)}
                </div>
              ) : filteredCasts.length > 0 ? (
                <>
                  <Virtuoso
                    useWindowScroll
                    data={filteredCasts}
                    endReached={loadMore}
                    increaseViewportBy={800}
                    itemContent={(index, cast: Cast) => (
                      <div className="pb-3 sm:pb-4">
                        <CastCard
                          key={cast.hash}
                          cast={cast}
                          onOpenCast={(castHash) => {
                            openCast(castHash)
                          }}
                          onOpenMiniApp={(url, title) => setMiniApp({ url, title })}
                          onQuote={handleQuote}
                          onDelete={handleDelete}
                          onSelectUser={openUser}
                          onReply={(c) => {
                            setReplyToCast({
                              hash: c.hash,
                              text: c.text,
                              timestamp: c.timestamp,
                              author: {
                                fid: c.author.fid,
                                username: c.author.username,
                                displayName: c.author.display_name,
                                pfpUrl: c.author.pfp_url || null,
                              },
                            })
                            setComposeOpen(true)
                          }}
                          currentUserFid={userFid || undefined}
                          currentUserFids={manageableFids || undefined}
                          isPro={userIsPro}
                        />
                      </div>
                    )}
                    components={{
                      Footer: () => isFetchingNextPage ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : null
                    }}
                  />
                </>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  No hay casts para mostrar
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - desktop only, sticky */}
      <div className="hidden lg:block w-80 shrink-0 sticky top-0 h-screen py-6">
        <RightSidebar
          onSelectUser={openUser}
          onSelectCast={(castHash: string) => {
            openCast(castHash)
          }}
        />
      </div>

      {/* Mini App Drawer */}
      <MiniAppDrawer
        open={!!miniApp}
        onClose={() => setMiniApp(null)}
        url={miniApp?.url || null}
        title={miniApp?.title || ''}
      />

      {/* Compose Modal para Quote y Reply */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open)
          if (!open) {
            setQuoteContent('')
            setReplyToCast(null)
          }
        }}
        defaultAccountId={userAccountId}
        defaultEmbed={quoteContent}
        defaultReplyTo={replyToCast}
      />
    </div>
  )
}

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <FeedPageInner />
    </Suspense>
  )
}
