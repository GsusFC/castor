'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { CastCard } from '@/components/feed/CastCard'
import { NotificationCard } from '@/components/feed/NotificationCard'
import { RightSidebar } from '@/components/feed/RightSidebar'
import { ProfileView } from '@/components/profile/ProfileView'
import { ConversationView } from '@/components/feed/ConversationView'
import { cn } from '@/lib/utils'
import { useNotificationStream } from '@/hooks'
import type { ReplyToCast } from '@/components/compose/types'

const ComposeModal = dynamic(() => import('@/components/compose/ComposeModal').then(mod => mod.ComposeModal), {
  ssr: false,
})

const MiniAppDrawer = dynamic(() => import('@/components/feed/MiniAppDrawer').then(mod => mod.MiniAppDrawer), {
  ssr: false,
})

type FeedTab = 'home' | 'following' | 'trending' | 'notifications' | 'channel'

interface SelectedChannel {
  id: string
  name: string
  image_url?: string
}

interface UserProfile {
  pfpUrl?: string
  username?: string
}
type NotificationFilter = 'all' | 'reply' | 'mention' | 'like' | 'recast' | 'follow'

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

const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'reply', label: 'Replies' },
  { value: 'mention', label: 'Mentions' },
  { value: 'like', label: 'Likes' },
  { value: 'recast', label: 'Recasts' },
  { value: 'follow', label: 'Follows' },
]

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>('home')
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all')
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)
  const [userIsPro, setUserIsPro] = useState(false)
  const [miniApp, setMiniApp] = useState<{ url: string; title: string } | null>(null)
  const [profile, setProfile] = useState<UserProfile>({})
  const [headerHidden, setHeaderHidden] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [quoteContent, setQuoteContent] = useState<string>('')
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null)
  const [selectedCastHash, setSelectedCastHash] = useState<string | null>(null)
  const lastScrollY = useRef(0)
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Notificaciones en tiempo real
  useNotificationStream({
    onNotification: (notification) => {
      // Invalidar queries de notificaciones cuando llegue algo nuevo
      if (notification.type !== 'connected') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
    },
  })

  // Detectar cuando el header está oculto
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current
      
      if (currentScrollY > 100 && scrollingDown) {
        setHeaderHidden(true)
      } else if (currentScrollY < lastScrollY.current) {
        setHeaderHidden(false)
      }
      
      if (currentScrollY < 50) {
        setHeaderHidden(false)
      }
      
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Obtener FID y perfil del usuario logueado
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me')
        const data = await res.json()
        if (data.fid) {
          setUserFid(data.fid)
          if (data.accountId) setUserAccountId(data.accountId)
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

  // Feed query
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', activeTab, userFid, selectedChannel?.id],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        type: activeTab === 'notifications' ? 'trending' : activeTab,
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
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: activeTab !== 'notifications',
  })

  // Notifications query
  const notificationsQuery = useInfiniteQuery({
    queryKey: ['notifications', userFid, notificationFilter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '25' })
      if (pageParam) params.set('cursor', pageParam)
      if (userFid) params.set('fid', userFid.toString())

      const res = await fetch(`/api/feed/notifications?${params}`)
      return res.json()
    },
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: activeTab === 'notifications' && !!userFid,
  })

  // Flatten and dedupe casts by hash
  const allCasts = feedQuery.data?.pages.flatMap((page) => page.casts) || []
  const casts = allCasts.filter(
    (cast: Cast, index: number, self: Cast[]) => 
      cast?.hash && self.findIndex((c: Cast) => c?.hash === cast.hash) === index
  )
  
  // Flatten and filter notifications
  const allNotifications = notificationsQuery.data?.pages.flatMap((page) => page.notifications) || []
  const notifications = notificationFilter === 'all' 
    ? allNotifications 
    : allNotifications.filter((n: { type: string }) => n.type === notificationFilter)

  const isLoading = activeTab === 'notifications' 
    ? notificationsQuery.isLoading 
    : feedQuery.isLoading

  const hasMore = activeTab === 'notifications'
    ? notificationsQuery.hasNextPage
    : feedQuery.hasNextPage

  const loadMore = useCallback(() => {
    if (activeTab === 'notifications') {
      if (!notificationsQuery.isFetchingNextPage) {
        notificationsQuery.fetchNextPage()
      }
    } else {
      if (!feedQuery.isFetchingNextPage) {
        feedQuery.fetchNextPage()
      }
    }
  }, [activeTab, feedQuery, notificationsQuery])

  // Infinite scroll con IntersectionObserver
  useEffect(() => {
    const target = loadMoreRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

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
      {selectedCastHash ? (
        <ConversationView
          castHash={selectedCastHash}
          onBack={() => setSelectedCastHash(null)}
          onSelectUser={setSelectedProfileUsername}
          onSelectCast={setSelectedCastHash}
          onReply={(c) => {
            setReplyToCast({
              hash: c.hash,
              text: '',
              timestamp: new Date().toISOString(),
              author: {
                fid: c.author.fid,
                username: c.author.username,
                displayName: c.author.username,
                pfpUrl: null,
              },
            })
            setComposeOpen(true)
          }}
          onOpenComposer={() => setComposeOpen(true)}
          userPfp={profile.pfpUrl}
        />
      ) : selectedProfileUsername ? (
        <ProfileView 
          username={selectedProfileUsername} 
          onBack={() => setSelectedProfileUsername(null)}
          onSelectUser={setSelectedProfileUsername}
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
      <>
      {/* Background cover for scroll content */}
      <div className="sticky top-0 z-30 h-6 bg-background" />
      {/* Tabs Header - sticky maintains position */}
      <div className="sticky top-6 z-40 pb-3 bg-background border-b border-border/50">
        <div className="flex items-center gap-2">
          {/* Avatar/Profile button */}
          <button
            onClick={() => profile.username && setSelectedProfileUsername(profile.username)}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            {profile.pfpUrl ? (
              <img src={profile.pfpUrl} alt="" className="w-10 h-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
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
              { id: 'notifications', label: 'Notifs' },
            ] as { id: FeedTab; label: string }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  if (tab.id !== 'channel') setSelectedChannel(null)
                }}
                className={cn(
                  "flex-1 h-9 px-3 text-sm font-medium rounded-full transition-colors",
                  activeTab === tab.id && activeTab !== 'channel'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
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
                setSelectedChannel(null)
                setActiveTab('home')
              }}
              className="h-9 px-3 text-sm font-medium rounded-full bg-primary text-primary-foreground"
            >
              #{selectedChannel.name} ✕
            </button>
          )}
        </div>
      </div>

      {/* Notification Filters */}
      {activeTab === 'notifications' && (
        <div className="flex items-center justify-center gap-1 mt-4 mb-4 overflow-x-auto pb-2">
          {NOTIFICATION_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setNotificationFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
                notificationFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className={cn("space-y-4", activeTab !== 'notifications' && "mt-4")}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'notifications' ? (
          notifications.length > 0 ? (
            notifications.map((notification: { type: string; most_recent_timestamp?: string }, i: number) => (
              <NotificationCard 
                key={`${notification.type}-${notification.most_recent_timestamp}-${i}`} 
                notification={notification as any}
                onUserClick={(username) => setSelectedProfileUsername(username)}
                onCastClick={(castHash) => {
                  // Mostrar conversación inline
                  setSelectedCastHash(castHash)
                }}
              />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-12">
              No hay notificaciones
            </p>
          )
        ) : casts.length > 0 ? (
          casts.map((cast: Cast) => (
            <CastCard
              key={cast.hash}
              cast={cast}
              onOpenMiniApp={(url, title) => setMiniApp({ url, title })}
              onQuote={handleQuote}
              onDelete={handleDelete}
              onSelectUser={setSelectedProfileUsername}
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
          ))
        ) : (
          <p className="text-center text-muted-foreground py-12">
            No hay casts para mostrar
          </p>
        )}

        {/* Load More - Infinite Scroll Trigger */}
        <div ref={loadMoreRef} className="py-4">
          {(feedQuery.isFetchingNextPage || notificationsQuery.isFetchingNextPage) && (
            <div className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
      </>
      )}
      </div>

      {/* Right Sidebar - desktop only, sticky */}
      <div className="hidden lg:block w-80 shrink-0 sticky top-0 h-screen py-6">
        <RightSidebar onSelectUser={setSelectedProfileUsername} />
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
