'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { Virtuoso } from 'react-virtuoso'
import { CastCard } from '@/components/feed/CastCard'
import { ConversationView } from '@/components/feed/ConversationView'
import { ProfileView } from '@/components/profile/ProfileView'
import { ChannelHeader } from '@/components/feed/ChannelHeader'
import type { ReplyToCast } from '@/components/compose/types'
import type { Cast } from '@/components/feed/cast-card'
import {
  MUTED_FIDS_STORAGE_KEY,
  BLOCKED_FIDS_STORAGE_KEY,
  MODERATION_UPDATED_EVENT,
  readFidListFromStorage,
} from '@/components/feed/cast-card'
import { usePinnedChannels } from '@/hooks/usePinnedChannels'
import { AppHeader } from '@/components/v2/AppHeader'
import { cn } from '@/lib/utils'
import { Loader2, User, Hash } from 'lucide-react'
import { toast } from 'sonner'

// Lazy load ComposeModal for reply/quote
const ComposeModal = dynamic(
  () => import('@/components/compose/ComposeModal').then(mod => ({ default: mod.ComposeModal }))
)

type FeedTab = 'home' | 'following' | 'trending' | 'channel'

interface FeedV2ClientProps {
  user: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
}

interface SelectedChannel {
  id: string
  name: string
  image_url?: string
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const CastSkeleton = () => (
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
  </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────

function FeedV2Inner({ user }: FeedV2ClientProps) {
  const queryClient = useQueryClient()
  const { pinnedChannels } = usePinnedChannels()

  // User data from /api/me
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)
  const [userSignerUuid, setUserSignerUuid] = useState<string | null>(null)
  const [userIsPro, setUserIsPro] = useState(false)
  const [manageableFids, setManageableFids] = useState<number[] | null>(null)
  const [profile, setProfile] = useState<{ pfpUrl?: string; username?: string }>({})

  // Feed state
  const [activeTab, setActiveTab] = useState<FeedTab>('home')
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(null)

  // Overlay state
  const [selectedCast, setSelectedCast] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [quoteContent, setQuoteContent] = useState('')
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)

  // Moderation
  const [moderationState, setModerationState] = useState<{
    mutedFids: Set<number>
    blockedFids: Set<number>
  }>(() => ({ mutedFids: new Set(), blockedFids: new Set() }))

  useEffect(() => {
    const syncModeration = () => {
      const muted = readFidListFromStorage(MUTED_FIDS_STORAGE_KEY)
      const blocked = readFidListFromStorage(BLOCKED_FIDS_STORAGE_KEY)
      setModerationState({ mutedFids: new Set(muted), blockedFids: new Set(blocked) })
    }
    syncModeration()
    window.addEventListener(MODERATION_UPDATED_EVENT, syncModeration)
    window.addEventListener('storage', syncModeration)
    return () => {
      window.removeEventListener(MODERATION_UPDATED_EVENT, syncModeration)
      window.removeEventListener('storage', syncModeration)
    }
  }, [])

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me')
        const data = await res.json()
        if (data.fid) {
          setUserFid(data.fid)
          if (data.accountId) setUserAccountId(data.accountId)
          if (data.signerUuid) setUserSignerUuid(data.signerUuid)
          if (typeof data.isPro === 'boolean') setUserIsPro(data.isPro)
          if (Array.isArray(data.manageableFids)) setManageableFids(data.manageableFids)
          const profileRes = await fetch(`/api/users/${data.fid}`)
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            const u = profileData.user || profileData
            setProfile({ pfpUrl: u.pfp_url || '', username: u.username || '' })
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }
    fetchUser()
  }, [])

  // Channel info fetch
  useEffect(() => {
    if (!selectedChannelId) {
      setSelectedChannel(null)
      return
    }
    setSelectedChannel(prev => {
      if (prev?.id === selectedChannelId) return prev
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
        .catch(() => setSelectedChannel({ id: selectedChannelId, name: selectedChannelId }))
      return { id: selectedChannelId, name: selectedChannelId }
    })
  }, [selectedChannelId])

  // Tab helpers
  const handleSetTab = useCallback((tab: FeedTab) => {
    setActiveTab(tab)
    setSelectedChannelId(null)
    setSelectedCast(null)
    setSelectedUser(null)
  }, [])

  const handleOpenChannel = useCallback((channelId: string) => {
    setActiveTab('channel')
    setSelectedChannelId(channelId)
    setSelectedCast(null)
    setSelectedUser(null)
  }, [])

  const handleOpenCast = useCallback((castHash: string) => {
    setSelectedCast(castHash)
    setSelectedUser(null)
  }, [])

  const handleOpenUser = useCallback((username: string) => {
    setSelectedUser(username)
    setSelectedCast(null)
  }, [])

  const handleCloseOverlay = useCallback(() => {
    setSelectedCast(null)
    setSelectedUser(null)
  }, [])

  // Feed query
  const requiresFid = activeTab === 'home' || activeTab === 'following'
  const isWaitingForFid = requiresFid && userFid === null
  const isFeedEnabled = !requiresFid || userFid !== null

  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', activeTab, userFid, selectedChannelId ?? null] as const,
    queryFn: async ({ queryKey, pageParam }) => {
      const [, type, fid, channelId] = queryKey
      const payload: Record<string, unknown> = { type, limit: 20 }
      if (typeof pageParam === 'string' && pageParam.trim().length > 0) {
        payload.cursor = pageParam.trim()
      }
      if (fid && (type === 'following' || type === 'home')) payload.fid = fid
      if (type === 'channel' && channelId) payload.channel = channelId

      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.json()
    },
    enabled: isFeedEnabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    getNextPageParam: (lastPage) => {
      const cursor = lastPage?.next?.cursor
      if (typeof cursor !== 'string') return undefined
      const trimmed = cursor.trim()
      return trimmed.length > 0 ? trimmed : undefined
    },
    initialPageParam: undefined as string | undefined,
  })

  // Flatten + dedupe + filter
  const allCasts = feedQuery.data?.pages.flatMap((p) => p.casts) || []
  const deduped = allCasts.filter(
    (cast: Cast, idx: number, self: Cast[]) =>
      cast?.hash && self.findIndex((c: Cast) => c?.hash === cast.hash) === idx
  )
  const filteredCasts = deduped.filter((cast: Cast) => {
    const fid = cast?.author?.fid
    if (!Number.isFinite(fid)) return true
    return !moderationState.blockedFids.has(fid) && !moderationState.mutedFids.has(fid)
  })

  const isLoading = feedQuery.isLoading || isWaitingForFid
  const isFetchingNextPage = feedQuery.isFetchingNextPage
  const hasMore = isFeedEnabled ? feedQuery.hasNextPage : false

  const loadMore = useCallback(() => {
    if (!isFeedEnabled || !hasMore || isLoading || isFetchingNextPage) return
    feedQuery.fetchNextPage()
  }, [feedQuery, hasMore, isFeedEnabled, isFetchingNextPage, isLoading])

  // Handlers
  const handleQuote = (castUrl: string) => {
    setQuoteContent(castUrl)
    setComposeOpen(true)
  }

  const handleDelete = async (castHash: string) => {
    try {
      const res = await fetch(`/api/feed/cast/${castHash}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Cast deleted')
        queryClient.invalidateQueries({ queryKey: ['feed'] })
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error deleting cast')
      }
    } catch {
      toast.error('Error deleting cast')
    }
  }

  const handleReply = (c: Cast) => {
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
  }

  // Prefetch on hover
  const prefetchTab = useCallback((tab: FeedTab) => {
    if (tab === activeTab) return
    const tabRequiresFid = tab === 'home' || tab === 'following'
    if (tabRequiresFid && !userFid) return
    queryClient.prefetchInfiniteQuery({
      queryKey: ['feed', tab, userFid, null] as const,
      queryFn: async ({ queryKey }) => {
        const [, type, fid] = queryKey
        const payload: Record<string, unknown> = { type, limit: 20 }
        if ((type === 'following' || type === 'home') && fid) payload.fid = fid
        const r = await fetch('/api/feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        return r.json()
      },
      getNextPageParam: (lastPage: any) => {
        const cursor = lastPage?.next?.cursor
        if (typeof cursor !== 'string') return undefined
        const trimmed = cursor.trim()
        return trimmed.length > 0 ? trimmed : undefined
      },
      initialPageParam: undefined as string | undefined,
      staleTime: 30_000,
    })
  }, [activeTab, queryClient, userFid])

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="hidden sm:block">
        <AppHeader user={user} />
      </div>

      <main className="max-w-2xl mx-auto px-4">
        {/* Overlays: Conversation / Profile */}
        {selectedCast ? (
          <ConversationView
            castHash={selectedCast}
            onBack={handleCloseOverlay}
            onSelectUser={handleOpenUser}
            onSelectCast={handleOpenCast}
            onQuote={handleQuote}
            currentUserFid={userFid || undefined}
            currentUserFids={manageableFids || undefined}
            onDelete={handleDelete}
          />
        ) : selectedUser ? (
          <ProfileView
            username={selectedUser}
            onBack={handleCloseOverlay}
            onSelectUser={handleOpenUser}
            onOpenCast={handleOpenCast}
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
            {/* ── Tab Bar ── */}
            <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50 py-3 -mx-4 px-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {/* User avatar */}
                <button
                  onClick={() => profile.username && handleOpenUser(profile.username)}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  {profile.pfpUrl ? (
                    <Image
                      src={profile.pfpUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-full object-cover border border-border/10"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center border border-border/10">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </button>

                {/* Feed tabs */}
                {(['home', 'following', 'trending'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleSetTab(tab)}
                    onMouseEnter={() => prefetchTab(tab)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors',
                      activeTab === tab && !selectedChannelId
                        ? 'bg-foreground text-background'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {tab === 'home' ? 'Home' : tab === 'following' ? 'Following' : 'Trending'}
                  </button>
                ))}

                {/* Pinned channels */}
                {pinnedChannels.slice(0, 5).map((ch) => (
                  <button
                    key={`pin-${ch.id}`}
                    onClick={() => handleOpenChannel(ch.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors',
                      selectedChannelId === ch.id
                        ? 'bg-foreground text-background'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {ch.image_url ? (
                      <Image src={ch.image_url} alt="" width={16} height={16} className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <Hash className="w-3 h-3" />
                    )}
                    <span className="truncate max-w-[80px]">{ch.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Header */}
            {activeTab === 'channel' && selectedChannel && (
              <ChannelHeader
                channelId={selectedChannel.id}
                onBack={() => handleSetTab('home')}
                signerUuid={userSignerUuid || undefined}
              />
            )}

            {/* ── Cast Feed ── */}
            <div className={cn(activeTab !== 'channel' ? 'mt-4' : 'mt-2')}>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <CastSkeleton key={`skel-${i}`} />)}
                </div>
              ) : filteredCasts.length > 0 ? (
                <Virtuoso
                  useWindowScroll
                  data={filteredCasts}
                  endReached={loadMore}
                  increaseViewportBy={800}
                  itemContent={(_index, cast: Cast) => (
                    <div className="pb-3">
                      <CastCard
                        key={cast.hash}
                        cast={cast}
                        onOpenCast={handleOpenCast}
                        onQuote={handleQuote}
                        onDelete={handleDelete}
                        onSelectUser={handleOpenUser}
                        onReply={() => handleReply(cast)}
                        currentUserFid={userFid || undefined}
                        currentUserFids={manageableFids || undefined}
                        isPro={userIsPro}
                      />
                    </div>
                  )}
                  components={{
                    Footer: () =>
                      isFetchingNextPage ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : null,
                  }}
                />
              ) : (
                <p className="text-center text-muted-foreground py-16 text-sm">
                  No casts to show
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Compose Modal for Quote/Reply */}
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
    </>
  )
}

export function FeedV2Client(props: FeedV2ClientProps) {
  return (
    <Suspense fallback={null}>
      <FeedV2Inner {...props} />
    </Suspense>
  )
}
