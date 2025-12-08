'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { CastCard } from '@/components/feed/CastCard'
import { NotificationCard } from '@/components/feed/NotificationCard'
import { AIReplyDialog } from '@/components/feed/AIReplyDialog'
import { MiniAppDrawer } from '@/components/feed/MiniAppDrawer'
import { EditProfileDialog } from '@/components/profile/EditProfileDialog'
import { LeftSidebar } from '@/components/feed/LeftSidebar'
import { RightSidebar } from '@/components/feed/RightSidebar'
import { cn } from '@/lib/utils'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'

type FeedTab = 'home' | 'following' | 'trending' | 'notifications' | 'channel'

interface SelectedChannel {
  id: string
  name: string
  image_url?: string
}

interface UserProfile {
  displayName?: string
  bio?: string
  pfpUrl?: string
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
  const [selectedCast, setSelectedCast] = useState<Cast | null>(null)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [userFid, setUserFid] = useState<number | null>(null)
  const [miniApp, setMiniApp] = useState<{ url: string; title: string } | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile>({})
  const [headerHidden, setHeaderHidden] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(null)
  const lastScrollY = useRef(0)

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
          // Cargar perfil completo
          const profileRes = await fetch(`/api/users/${data.fid}`)
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            setProfile({
              displayName: profileData.display_name || '',
              pfpUrl: profileData.pfp_url || '',
              bio: profileData.bio || '',
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

  const handleAIReply = (cast: Cast) => {
    setSelectedCast(cast)
    setAiDialogOpen(true)
  }

  const handleLike = async (hash: string) => {
    try {
      const res = await fetch('/api/feed/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: hash, reactionType: 'like' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Like añadido')
    } catch {
      toast.error('Error al dar like')
    }
  }

  const handleRecast = async (hash: string) => {
    try {
      const res = await fetch('/api/feed/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: hash, reactionType: 'recast' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Recast añadido')
    } catch {
      toast.error('Error al recastear')
    }
  }

  const handleSave = async (cast: Cast) => {
    toast.info('Guardado - Próximamente')
  }

  const handlePublishReply = async (text: string, parentHash: string) => {
    toast.success('Respuesta publicada (simulado)')
  }

  const handleScheduleReply = async (text: string, parentHash: string) => {
    toast.info('Programar respuesta - Próximamente')
  }

  // Click en notificación -> abrir cast (solo para replies y mentions)
  const handleNotificationClick = (notification: { type: string; cast?: Cast }) => {
    const replyableTypes = ['reply', 'mention']
    if (replyableTypes.includes(notification.type) && notification.cast) {
      setSelectedCast(notification.cast as Cast)
      setAiDialogOpen(true)
    }
  }

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_300px] gap-6 -mt-4 sm:-mt-6 md:-mt-8">
      {/* Left Sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:block">
        <LeftSidebar onSelectChannel={handleSelectChannel} />
      </div>

      {/* Main Feed */}
      <div className="max-w-2xl w-full mx-auto lg:mx-0">
      {/* Sticky Tabs Header */}
      <div className={cn(
        "sticky z-40 pt-4 sm:pt-6 pb-4 bg-background/80 backdrop-blur-lg border-b border-border/50 transition-all duration-300 lg:-mx-0 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 lg:px-0",
        headerHidden ? "top-0" : "top-14 sm:top-16"
      )}>
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          {/* Avatar/Profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            title="Editar perfil"
          >
            {profile.pfpUrl ? (
              <img 
                src={profile.pfpUrl} 
                alt="Perfil"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </button>

          {/* Feed tabs */}
          {(['home', 'following', 'trending', 'notifications'] as FeedTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab !== 'channel') setSelectedChannel(null)
              }}
              className={cn(
                "flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors",
                activeTab === tab && activeTab !== 'channel'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'home' && 'Home'}
              {tab === 'following' && (
                <span><span className="hidden sm:inline">Following</span><span className="sm:hidden">Feed</span></span>
              )}
              {tab === 'trending' && (
                <span><span className="hidden sm:inline">Trending</span><span className="sm:hidden">🔥</span></span>
              )}
              {tab === 'notifications' && '🔔'}
            </button>
          ))}

          {/* Canal seleccionado */}
          {selectedChannel && (
            <button
              onClick={() => {
                setSelectedChannel(null)
                setActiveTab('home')
              }}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md bg-primary text-primary-foreground"
            >
              {selectedChannel.image_url && (
                <img src={selectedChannel.image_url} alt="" className="w-4 h-4 rounded" />
              )}
              <span className="truncate max-w-20">{selectedChannel.name}</span>
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
                onClick={() => handleNotificationClick(notification as any)}
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
              onAIReply={handleAIReply}
              onLike={handleLike}
              onRecast={handleRecast}
              onSave={handleSave}
              onOpenMiniApp={(url, title) => setMiniApp({ url, title })}
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
      <div className="hidden xl:block">
        <RightSidebar />
      </div>

      {/* AI Reply Dialog */}
      <AIReplyDialog
        cast={selectedCast}
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onPublish={handlePublishReply}
        onSchedule={handleScheduleReply}
      />

      {/* Mini App Drawer */}
      <MiniAppDrawer
        open={!!miniApp}
        onClose={() => setMiniApp(null)}
        url={miniApp?.url || null}
        title={miniApp?.title || ''}
      />

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        currentProfile={profile}
        onSave={async () => {
          if (!userFid) return
          try {
            const profileRes = await fetch(`/api/users/${userFid}`)
            if (profileRes.ok) {
              const data = await profileRes.json()
              setProfile({
                displayName: data.display_name || '',
                pfpUrl: data.pfp_url || '',
                bio: data.bio || '',
              })
            }
          } catch (error) {
            console.error('Error reloading profile:', error)
          }
        }}
      />
    </div>
  )
}
