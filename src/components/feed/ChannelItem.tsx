'use client'

import { Hash, MoreVertical, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, SPACING } from '@/lib/spacing-system'
import { Button } from '@/components/ui/button'

interface Channel {
  id: string
  name: string
  image_url?: string
  follower_count?: number
  description?: string
}

interface ChannelItemProps {
  channel: Channel
  onClick?: () => void
  showMeta?: boolean
  variant?: 'default' | 'compact'
}

export function ChannelItem({
  channel,
  onClick,
  showMeta = true,
  variant = 'default',
}: ChannelItemProps) {
  const isCompact = variant === 'compact'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left transition-all',
        isCompact
          ? 'p-3 rounded-md hover:bg-muted/50'
          : 'p-4 rounded-lg border border-border hover:border-border/80 hover:bg-muted/30 hover:shadow-sm'
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          {channel.image_url ? (
            <img
              src={channel.image_url}
              alt={channel.name}
              className={cn(
                'rounded',
                isCompact ? 'w-5 h-5' : 'w-8 h-8 sm:w-10 sm:h-10'
              )}
            />
          ) : (
            <div
              className={cn(
                'rounded bg-muted/50 flex items-center justify-center',
                isCompact ? 'w-5 h-5' : 'w-8 h-8 sm:w-10 sm:h-10'
              )}
            >
              <Hash
                className={cn(
                  'text-muted-foreground',
                  isCompact ? 'w-3 h-3' : 'w-4 h-4'
                )}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4
              className={cn(
                'font-semibold truncate',
                isCompact ? 'text-sm' : 'text-sm sm:text-base'
              )}
            >
              {channel.name}
            </h4>
            {!isCompact && (
              <button className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 opacity-0 hover:opacity-100">
                <MoreVertical className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Meta info - only show in default variant */}
          {showMeta && !isCompact && channel.follower_count !== undefined && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {channel.follower_count > 1000
                ? `${(channel.follower_count / 1000).toFixed(1)}K members`
                : `${channel.follower_count} members`}
              {' • Following'}
            </p>
          )}

          {/* Description - only show if available */}
          {!isCompact && channel.description && (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-2">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      {/* Hover actions - only show in default variant */}
      {!isCompact && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 opacity-0 hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <Share2 className="w-3 h-3 mr-1" />
            Share
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            Follow
          </Button>
        </div>
      )}
    </button>
  )
}
