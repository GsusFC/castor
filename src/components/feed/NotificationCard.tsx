'use client'

import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

interface NotificationBadge {
  label: string
  icon: string
  color: string
}

interface NotificationAuthor {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
}

interface FollowItem {
  user: NotificationAuthor
}

interface ReactionItem {
  user: NotificationAuthor
}

interface Notification {
  type: string
  most_recent_timestamp?: string
  badge: NotificationBadge
  cast?: {
    hash: string
    text: string
    author?: NotificationAuthor
  }
  follows?: FollowItem[]
  reactions?: ReactionItem[]
  count?: number
}

interface NotificationCardProps {
  notification: Notification
  onClick?: () => void
  onUserClick?: (username: string) => void
  onCastClick?: (castHash: string) => void
}

const badgeColors: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  gray: 'bg-muted text-muted-foreground border-border',
}

export function NotificationCard({ notification, onClick, onUserClick, onCastClick }: NotificationCardProps) {
  const timestamp = notification.most_recent_timestamp ? new Date(notification.most_recent_timestamp) : null
  const timeAgo = timestamp && !isNaN(timestamp.getTime())
    ? formatDistanceToNow(timestamp, { addSuffix: false, locale: es })
    : ''

  const badge = notification.badge
  const colorClass = badgeColors[badge.color] || badgeColors.gray

  // Obtener actores según el tipo de notificación
  const getMainActor = (): NotificationAuthor | undefined => {
    if (notification.follows?.length) {
      return notification.follows[0].user
    }
    if (notification.reactions?.length) {
      return notification.reactions[0].user
    }
    if (notification.cast?.author) {
      return notification.cast.author
    }
    return undefined
  }

  const mainActor = getMainActor()
  const totalCount = notification.count || 1
  const otherCount = totalCount > 1 ? totalCount - 1 : 0

  // Solo reply abre el composer para responder directamente
  const isReplyable = notification.type === 'reply'
  const hasCast = !!notification.cast?.hash

  const handleClick = () => {
    if (hasCast && notification.cast && onCastClick) {
      onCastClick(notification.cast.hash)
      return
    }

    if (mainActor?.username && onUserClick) {
      onUserClick(mainActor.username)
    }
  }

  return (
    <div className="flex items-start gap-2">
      {/* Badge - fuera de la card */}
      <span className={cn(
        "px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0 mt-3",
        colorClass
      )}>
        {badge.icon}
      </span>

      {/* Card - siempre clickeable */}
      <div
        onClick={handleClick}
        className="flex-1 min-w-0 p-3 border border-border/50 rounded-xl bg-card hover:bg-muted/30 hover:shadow-sm cursor-pointer transition-all text-left shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {mainActor?.pfp_url && (
            <Image
              src={mainActor.pfp_url}
              alt={mainActor.username}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-cover"
              unoptimized
            />
          )}
          <span className="min-w-0 font-medium text-[13px] truncate">
            @{mainActor?.username}
            {otherCount > 0 && (
              <span className="text-muted-foreground"> +{otherCount}</span>
            )}
          </span>
          <span className="text-muted-foreground text-[11px] ml-auto shrink-0">{timeAgo}</span>
        </div>

        {notification.cast?.text && (
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground line-clamp-3 break-words">
            {notification.cast.text}
          </p>
        )}

        {isReplyable && hasCast && onClick && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label="Responder"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Responder
            </button>
          </div>
        )}

        {(notification.type === 'follow' || notification.type === 'follows') && !notification.cast && (
          <p className="mt-1 text-sm text-muted-foreground">
            empezaron a seguirte
          </p>
        )}
      </div>
    </div>
  )
}
