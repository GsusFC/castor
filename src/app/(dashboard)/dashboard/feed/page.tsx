'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { CastCard } from '@/components/feed/CastCard'
import { NotificationCard } from '@/components/feed/NotificationCard'
import { MiniAppDrawer } from '@/components/feed/MiniAppDrawer'
import { RightSidebar } from '@/components/feed/RightSidebar'
import { ComposeModal } from '@/components/compose/ComposeModal'
import type { ReplyToCast } from '@/components/compose/types'
import { cn } from '@/lib/utils'
import { Loader2, User } from 'lucide-react'
import { useNotificationStream } from '@/hooks'
import Link from 'next/link'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

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
  { value: 'reply', label: '💬' },
  { value: 'mention', label: '@' },
  { value: 'like', label: '❤️' },
  { value: 'recast', label: '🔄' },
  { value: 'follow', label: '👤' },
]

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>('home')
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all')
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)
  const [miniApp, setMiniApp] = useState<{ url: string; title: string } | null>(null)
  const [profile, setProfile] = useState<UserProfile>({})
  const [headerHidden, setHeaderHidden] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [quoteContent, setQuoteContent] = useState<string>('')
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)
  const lastScrollY = useRef(0)
  const queryClient = useQueryClient()

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

  const loadMore = () => {
    if (activeTab === 'notifications') {
      notificationsQuery.fetchNextPage()
    } else {
      feedQuery.fetchNextPage()
    }
  }

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
    <div className="flex gap-6 lg:gap-8 w-full">
      {/* Main Feed */}
      <div className="flex-1 min-w-0">
      {/* Sticky Tabs Header */}
      <div className="sticky top-0 z-40 py-3 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-full max-w-full">
          {/* Avatar/Profile link - 44px touch target */}
          <Link
            href={profile.username ? `/dashboard/user/${profile.username}` : '#'}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            title="Mi perfil"
          >
            {profile.pfpUrl ? (
              <img 
                src={profile.pfpUrl} 
                alt="Perfil"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </Link>

          {/* Feed tabs - 44px touch targets */}
          {(['home', 'following', 'trending', 'notifications'] as FeedTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab !== 'channel') setSelectedChannel(null)
              }}
              className={cn(
                "w-11 h-11 flex items-center justify-center text-lg rounded-lg transition-colors flex-shrink-0",
                activeTab === tab && activeTab !== 'channel'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'home' && '🏠'}
              {tab === 'following' && '👥'}
              {tab === 'trending' && '🔥'}
              {tab === 'notifications' && '🔔'}
            </button>
          ))}

          {/* Canal seleccionado - 44px touch target */}
          {selectedChannel && (
            <button
              onClick={() => {
                setSelectedChannel(null)
                setActiveTab('home')
              }}
              className="h-11 flex items-center gap-1.5 px-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground flex-shrink-0"
            >
              {selectedChannel.image_url && (
                <img src={selectedChannel.image_url} alt="" className="w-5 h-5 rounded" />
              )}
              <span className="truncate max-w-16">{selectedChannel.name}</span>
              <span className="text-primary-foreground/70">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Filters */}
      {activeTab === 'notifications' && (
        <div className="flex items-center gap-1 mt-4 mb-4 overflow-x-auto pb-2">
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
            />
          ))
        ) : (
          <p className="text-center text-muted-foreground py-12">
            No hay casts para mostrar
          </p>
        )}

        {/* Load More */}
        {hasMore && !isLoading && (
          <button
            onClick={loadMore}
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cargar más...
          </button>
        )}
      </div>
      </div>

      {/* Right Sidebar - hidden on mobile/tablet/laptop */}
      <div className="hidden xl:block w-[320px] shrink-0">
        <RightSidebar />
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
