'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationCard } from '@/components/feed/NotificationCard'
import { ComposeModal } from '@/components/compose/ComposeModal'
import type { ReplyToCast } from '@/components/compose/types'
import { useNotifications } from '@/context/NotificationsContext'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type NotificationFilter = 'all' | 'reply' | 'mention' | 'like' | 'recast' | 'follow'

const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'reply', label: 'Replies' },
  { value: 'mention', label: 'Mentions' },
  { value: 'like', label: 'Likes' },
  { value: 'recast', label: 'Recasts' },
  { value: 'follow', label: 'Follows' },
]

const NotificationSkeleton = () => (
  <div className="flex items-start gap-2 animate-pulse">
    <div className="mt-3 h-4 w-7 rounded bg-muted/60 shrink-0" />
    <div className="flex-1 p-3 border border-border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-muted/60" />
        <div className="h-3 w-28 rounded bg-muted/60" />
        <div className="ml-auto h-3 w-12 rounded bg-muted/50" />
      </div>
      <div className="mt-2 space-y-2">
        <div className="h-3 w-full rounded bg-muted/50" />
        <div className="h-3 w-4/5 rounded bg-muted/40" />
      </div>
    </div>
  </div>
)

export function NotificationsDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const { isOpen, close } = useNotifications()
  const [isMobile, setIsMobile] = useState(false)

  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all')
  const [userFid, setUserFid] = useState<number | null>(null)
  const [userAccountId, setUserAccountId] = useState<string | null>(null)

  const [composeOpen, setComposeOpen] = useState(false)
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const loadMoreLockRef = useRef(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')

    const handleChange = () => {
      setIsMobile(mql.matches)
    }

    handleChange()
    mql.addEventListener('change', handleChange)

    return () => {
      mql.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/me')
        const data = await res.json()
        if (data?.fid) {
          setUserFid(data.fid)
          if (data.accountId) setUserAccountId(data.accountId)
          return
        }
        setUserFid(null)
      } catch {
        setUserFid(null)
      }
    }

    fetchUser()
  }, [])

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
    enabled: !!userFid && isOpen,
  })

  const allNotifications = notificationsQuery.data?.pages.flatMap((page) => page.notifications) || []
  const notifications = notificationFilter === 'all'
    ? allNotifications
    : allNotifications.filter((n: { type: string }) => n.type === notificationFilter)

  const isLoading = notificationsQuery.isLoading
  const isFetchingNextPage = notificationsQuery.isFetchingNextPage
  const hasMore = notificationsQuery.hasNextPage

  useEffect(() => {
    if (isFetchingNextPage) return
    loadMoreLockRef.current = false
  }, [isFetchingNextPage])

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isFetchingNextPage) return
    if (loadMoreLockRef.current) return
    loadMoreLockRef.current = true

    notificationsQuery.fetchNextPage()
  }, [hasMore, isFetchingNextPage, isLoading, notificationsQuery])

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

  const handleReplyFromNotification = useCallback((notification: any) => {
    const cast = notification?.cast
    const author = cast?.author
    const timestamp = cast?.timestamp || notification?.most_recent_timestamp
    if (!cast?.hash || !cast?.text || !author?.fid || !author?.username || !timestamp) return

    setReplyToCast({
      hash: cast.hash,
      text: cast.text,
      timestamp,
      author: {
        fid: author.fid,
        username: author.username,
        displayName: author.display_name ?? null,
        pfpUrl: author.pfp_url ?? null,
      },
    })

    setComposeOpen(true)
  }, [])

  const handleOpenUser = useCallback((username: string) => {
    close()
    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('castor:feed:open-user', { detail: { username } }))
      return
    }

    router.push(`/?user=${encodeURIComponent(username)}`)
  }, [close, pathname, router])

  const handleOpenCast = useCallback((castHash: string) => {
    close()
    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('castor:feed:open-cast', { detail: { castHash } }))
      return
    }

    router.push(`/?cast=${encodeURIComponent(castHash)}`)
  }, [close, pathname, router])

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 overflow-hidden',
          isMobile ? 'w-full h-[70dvh]' : 'w-full sm:w-[20vw] sm:min-w-[320px] sm:max-w-[520px]'
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <span className="font-medium truncate pr-10">Notifications</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
              <div className="flex flex-wrap items-center gap-1 px-4 py-2.5">
                {NOTIFICATION_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setNotificationFilter(filter.value)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-md transition-colors',
                      notificationFilter === filter.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={`Filtrar: ${filter.label}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 px-4 py-3 pb-safe">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <NotificationSkeleton key={`notif-skel-${i}`} />)
              ) : notifications.length > 0 ? (
                notifications.map((notification: { type: string; most_recent_timestamp?: string }, i: number) => (
                  <NotificationCard
                    key={`${notification.type}-${notification.most_recent_timestamp}-${i}`}
                    notification={notification as any}
                    onClick={() => handleReplyFromNotification(notification)}
                    onUserClick={handleOpenUser}
                    onCastClick={handleOpenCast}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  No hay notificaciones
                </p>
              )}

              <div ref={loadMoreRef} className="py-2">
                {notificationsQuery.isFetchingNextPage && (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ComposeModal
          open={composeOpen}
          onOpenChange={(open) => {
            setComposeOpen(open)
            if (!open) {
              setReplyToCast(null)
            }
          }}
          defaultAccountId={userAccountId}
          defaultReplyTo={replyToCast}
        />
      </SheetContent>
    </Sheet>
  )
}
