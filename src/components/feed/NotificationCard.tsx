'use client'

import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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
}

const badgeColors: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  gray: 'bg-muted text-muted-foreground border-border',
}

export function NotificationCard({ notification, onClick }: NotificationCardProps) {
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
  
  // Solo replies y mentions son clickeables para responder
  const isReplyable = ['reply', 'mention'].includes(notification.type)

  return (
    <div className="flex items-start gap-2">
      {/* Badge - fuera de la card */}
      <span className={cn(
        "px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0 mt-3",
        colorClass
      )}>
        {badge.icon}
      </span>

      {/* Card */}
      <div
        onClick={isReplyable ? onClick : undefined}
        className={cn(
          "flex-1 p-3 border border-border rounded-lg bg-card transition-colors text-left",
          isReplyable && "hover:bg-muted/30 cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2">
          {mainActor?.pfp_url && (
            <img 
              src={mainActor.pfp_url} 
              alt={mainActor.username}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="font-medium text-sm truncate">
            @{mainActor?.username}
            {otherCount > 0 && (
              <span className="text-muted-foreground"> +{otherCount}</span>
            )}
          </span>
          <span className="text-muted-foreground text-xs ml-auto">{timeAgo}</span>
        </div>

        {notification.cast?.text && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
            {notification.cast.text}
          </p>
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
