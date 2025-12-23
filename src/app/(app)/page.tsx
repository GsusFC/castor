'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { Virtuoso } from 'react-virtuoso'
import { CastCard } from '@/components/feed/CastCard'
import { MiniAppDrawer } from '@/components/feed/MiniAppDrawer'
import { ChannelHeader } from '@/components/feed/ChannelHeader'
import { RightSidebar } from '@/components/feed/RightSidebar'
import { ConversationView } from '@/components/feed/ConversationView'
import { ProfileView } from '@/components/profile/ProfileView'
import { ComposeModal } from '@/components/compose/ComposeModal'
import type { ReplyToCast } from '@/components/compose/types'
import { cn } from '@/lib/utils'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

type FeedTab = 'home' | 'following' | 'trending' | 'channel'

interface SelectedChannel {
  id: string
  name: string
  image_url?: string
}

interface UserProfile {
  pfpUrl?: string
  username?: string
}

interface Cast {
  hash: string
  text: string
  timestamp: string
  author: {
    fid: number
    username: string
    display_name: string
    pfp_url?: string
    pro?: { status: string }
  }
  reactions: {
    likes_count: number
    recasts_count: number
  }
  replies: { count: number }
  embeds?: {
    url?: string
    cast?: {
      hash: string
      text: string
      timestamp: string
      author: {
        fid: number
        username: string
        display_name: string
        pfp_url?: string
      }
      embeds?: { url: string; metadata?: { content_type?: string } }[]
      channel?: { id: string; name: string }
    }
    metadata?: {
      content_type?: string
      image?: { width_px: number; height_px: number }
      video?: {
        streams?: { codec_name?: string }[]
        duration_s?: number
      }
      html?: {
        ogImage?: { url: string }[]
        ogTitle?: string
      }
      frame?: {
        title?: string
        image?: string
      }
    }
  }[]
  channel?: {
    id: string
    name: string
    image_url?: string
  }
}

function FeedPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const [activeTab, setActiveTab] = useState<FeedTab>('home')
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)
  const [userSignerUuid, setUserSignerUuid] = useState<string | null>(null)
  const [userIsPro, setUserIsPro] = useState(false)
  const [miniApp, setMiniApp] = useState<{ url: string; title: string } | null>(null)
  const [profile, setProfile] = useState<UserProfile>({})
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(null)
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null)
  const [selectedConversationHash, setSelectedConversationHash] = useState<string | null>(null)

  const channelIdFromUrl = searchParams.get('channel')
  const castHashFromUrl = searchParams.get('cast')
  const usernameFromUrl = searchParams.get('user')

  const pushSearchParams = useCallback((updater: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParamsString)
    updater(next)

    const qs = next.toString()
    router.push(qs ? `/?${qs}` : '/')
  }, [router, searchParamsString])

  const openProfile = useCallback((username: string) => {
    setSelectedConversationHash(null)
    setSelectedProfileUsername(username)
    pushSearchParams((next) => {
      next.set('user', username)
      next.delete('cast')
    })
  }, [pushSearchParams])

  const openConversation = useCallback((castHash: string) => {
    setSelectedProfileUsername(null)
    setSelectedConversationHash(castHash)
    pushSearchParams((next) => {
      next.set('cast', castHash)
      next.delete('user')
    })
  }, [pushSearchParams])

  const closeOverlay = useCallback(() => {
    setSelectedConversationHash(null)
    setSelectedProfileUsername(null)
    pushSearchParams((next) => {
      next.delete('cast')
      next.delete('user')
    })
  }, [pushSearchParams])

  const clearChannelFromUrl = useCallback(() => {
    const next = new URLSearchParams(searchParamsString)
    next.delete('channel')

    const qs = next.toString()
    router.push(qs ? `/?${qs}` : '/')
  }, [router, searchParamsString])

  useEffect(() => {
    if (castHashFromUrl) {
      setSelectedProfileUsername(null)
      setSelectedConversationHash(castHashFromUrl)
      return
    }
    setSelectedConversationHash(null)
  }, [castHashFromUrl])

  useEffect(() => {
    // If a cast is selected via URL, it takes precedence.
    if (castHashFromUrl) return

    if (usernameFromUrl) {
      setSelectedConversationHash(null)
      setSelectedProfileUsername(usernameFromUrl)
      return
    }

    setSelectedProfileUsername(null)
  }, [castHashFromUrl, usernameFromUrl])

  useEffect(() => {
    if (!channelIdFromUrl) {
      // Si no hay channel en URL, limpiar selección
      setSelectedChannel(prev => {
        if (prev) setActiveTab('home')
        return null
      })
      return
    }

    // Si el canal ya está seleccionado, no hacer nada
    setSelectedChannel(prev => {
      if (prev?.id === channelIdFromUrl) return prev

      // Fetch channel info async
      fetch(`/api/channels/${channelIdFromUrl}`)
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
          setSelectedChannel({ id: channelIdFromUrl, name: channelIdFromUrl })
        })

      setActiveTab('channel')
      // Retornar placeholder mientras carga
      return { id: channelIdFromUrl, name: channelIdFromUrl }
    })
  }, [channelIdFromUrl])
  const [composeOpen, setComposeOpen] = useState(false)
  const [quoteContent, setQuoteContent] = useState<string>('')
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handleOpenCast = (event: Event) => {
      const detail = (event as CustomEvent).detail as { castHash?: string } | undefined
      const castHash = detail?.castHash
      if (!castHash) return
      openConversation(castHash)
    }

    const handleOpenUser = (event: Event) => {
      const detail = (event as CustomEvent).detail as { username?: string } | undefined
      const username = detail?.username
      if (!username) return
      openProfile(username)
    }

    window.addEventListener('castor:feed:open-cast', handleOpenCast)
    window.addEventListener('castor:feed:open-user', handleOpenUser)

    return () => {
      window.removeEventListener('castor:feed:open-cast', handleOpenCast)
      window.removeEventListener('castor:feed:open-user', handleOpenUser)
    }
  }, [openConversation, openProfile])

  // Obtener FID y perfil del usuario logueado
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me')
        const data = await res.json()
        if (data.fid) {
          setUserFid(data.fid)
          if (data.accountId) setUserAccountId(data.accountId)
          if (data.signerUuid) setUserSignerUuid(data.signerUuid)
          if (data.isPro) setUserIsPro(data.isPro)
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

  // Handler para seleccionar canal
  const handleSelectChannel = (channel: SelectedChannel) => {
    setSelectedChannel(channel)
    setActiveTab('channel')
  }

  const requiresFidForTab = activeTab === 'home' || activeTab === 'following'
  const isWaitingForFid = requiresFidForTab && userFid === null
  const isFeedEnabled = !requiresFidForTab || userFid !== null

  // Feed query
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', activeTab, userFid, selectedChannel?.id],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        type: activeTab,
        limit: '10',
      })
      if (pageParam) params.set('cursor', pageParam)
      if (userFid && (activeTab === 'following' || activeTab === 'home')) {
        params.set('fid', userFid.toString())
      }
      if (activeTab === 'channel' && selectedChannel) {
        params.set('channel', selectedChannel.id)
      }

      const res = await fetch(`/api/feed?${params}`)
      return res.json()
    },
    enabled: isFeedEnabled,
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    initialPageParam: undefined as string | undefined,
  })

  // Flatten and dedupe casts by hash
  const allCasts = feedQuery.data?.pages.flatMap((page) => page.casts) || []
  const casts = allCasts.filter(
    (cast: Cast, index: number, self: Cast[]) =>
      cast?.hash && self.findIndex((c: Cast) => c?.hash === cast.hash) === index
  )

  const isLoading = feedQuery.isLoading || isWaitingForFid
  const isFetchingNextPage = feedQuery.isFetchingNextPage
  const hasMore = isFeedEnabled ? feedQuery.hasNextPage : false

  const loadMoreLockRef = useRef(false)

  useEffect(() => {
    if (isFetchingNextPage) return
    loadMoreLockRef.current = false
  }, [isFetchingNextPage])

  const loadMore = useCallback(() => {
    if (!isFeedEnabled) return
    if (!hasMore || isLoading || isFetchingNextPage) return
    if (loadMoreLockRef.current) return
    loadMoreLockRef.current = true

    feedQuery.fetchNextPage()
  }, [feedQuery, hasMore, isFeedEnabled, isFetchingNextPage, isLoading])

  // Infinite scroll con IntersectionObserver
  useEffect(() => {
    const target = loadMoreRef.current
    if (!target) return

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0]
      if (!first?.isIntersecting) return
      loadMore()
    }, { threshold: 0.1, rootMargin: '100px' })

    observer.observe(target)
    return () => observer.disconnect()
  }, [loadMore])

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
        {selectedConversationHash ? (
          <ConversationView
            castHash={selectedConversationHash}
            onBack={() => {
              router.back()
            }}
            onSelectUser={(username) => {
              openProfile(username)
            }}
            onSelectCast={(hash) => openConversation(hash)}
            onQuote={handleQuote}
          />
        ) : selectedProfileUsername ? (
          <ProfileView
            username={selectedProfileUsername}
            onBack={() => closeOverlay()}
            onSelectUser={openProfile}
            onOpenCast={(castHash: string) => {
              openConversation(castHash)
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
            isPro={userIsPro}
          />
        ) : (
          <div className="flex flex-col">
            {/* Tabs Header - sticky at top-0 to match ViewHeader consistency */}
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Avatar/Profile button */}
                <button
                  onClick={() => profile.username && openProfile(profile.username)}
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
                <div className="flex-1 flex items-center gap-1 bg-muted/50 rounded-full p-1">
                  {([
                    { id: 'home', label: 'Home' },
                    { id: 'following', label: 'Following' },
                    { id: 'trending', label: 'Trending' },
                  ] as { id: FeedTab; label: string }[]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        clearChannelFromUrl()
                        setActiveTab(tab.id)
                        if (tab.id !== 'channel') setSelectedChannel(null)
                      }}
                      onMouseEnter={() => {
                        if (tab.id === activeTab) return
                        const tabRequiresFid = tab.id === 'following' || tab.id === 'home'
                        if (tabRequiresFid && !userFid) return

                        const params = new URLSearchParams({ type: tab.id, limit: '20' })
                        if (tabRequiresFid && userFid) {
                          params.set('fid', userFid.toString())
                        }

                        queryClient.prefetchInfiniteQuery({
                          queryKey: ['feed', tab.id, userFid, null],
                          queryFn: () => fetch(`/api/feed?${params}`).then(r => r.json()),
                          getNextPageParam: (lastPage: any) => lastPage.next?.cursor,
                          initialPageParam: undefined as string | undefined,
                          staleTime: 30 * 1000,
                        })
                      }}
                      className={cn(
                        "relative flex-1 h-9 px-3 text-sm rounded-full transition-all",
                        activeTab === tab.id && activeTab !== 'channel'
                          ? "bg-background text-foreground shadow-md border border-border/10 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
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
                      clearChannelFromUrl()
                    }}
                    className="h-9 px-3 text-sm font-medium rounded-full bg-primary text-primary-foreground shadow-sm ml-1"
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
                onBack={clearChannelFromUrl}
                signerUuid={userSignerUuid || undefined}
              />
            )}

            {/* Content Feed */}
            <div className={cn(activeTab !== 'channel' ? "mt-4" : "mt-2")}>
              {isLoading ? (
                <div className="space-y-3 sm:space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => <FeedCastSkeleton key={`cast-skel-${i}`} />)}
                </div>
              ) : casts.length > 0 ? (
                <>
                  <Virtuoso
                    useWindowScroll
                    data={casts}
                    endReached={loadMore}
                    increaseViewportBy={400}
                    itemContent={(index, cast: Cast) => (
                      <div className="pb-3 sm:pb-4">
                        <CastCard
                          key={cast.hash}
                          cast={cast}
                          onOpenCast={(castHash) => {
                            openConversation(castHash)
                          }}
                          onOpenMiniApp={(url, title) => setMiniApp({ url, title })}
                          onQuote={handleQuote}
                          onDelete={handleDelete}
                          onSelectUser={openProfile}
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
                          isPro={userIsPro}
                        />
                      </div>
                    )}
                    components={{
                      Footer: () => (
                        <div className="py-4">
                          {isFetchingNextPage && (
                            <div className="flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      )
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
          onSelectUser={openProfile}
          onSelectCast={(castHash: string) => {
            openConversation(castHash)
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
