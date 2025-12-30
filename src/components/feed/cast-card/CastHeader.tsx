'use client'

import { memo } from 'react'
import Image from 'next/image'
import { MoreHorizontal, Copy, Trash2, VolumeX, Ban, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { useAdaptiveLoading } from '@/hooks/useAdaptiveLoading'
import type { Cast } from './types'
import { getShortTimeAgo } from './utils'

interface CastHeaderProps {
  cast: Cast
  isOwnCast: boolean
  onSelectUser?: (username: string) => void
  onCopyCastHash: () => void
  onMuteUser: () => void
  onBlockUser: () => void
  onDelete?: () => Promise<void>
  showMoreMenu: boolean
  setShowMoreMenu: (show: boolean) => void
  isDeleting: boolean
}

function CastHeaderComponent({
  cast,
  isOwnCast,
  onSelectUser,
  onCopyCastHash,
  onMuteUser,
  onBlockUser,
  onDelete,
  showMoreMenu,
  setShowMoreMenu,
  isDeleting,
}: CastHeaderProps) {
  const queryClient = useQueryClient()
  const { shouldReduceData, isLowEndDevice } = useAdaptiveLoading()
  const timeAgo = getShortTimeAgo(cast.timestamp)

  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelectUser?.(cast.author.username)
        }}
        onMouseEnter={() => {
          // Skip prefetching on slow networks or low-end devices
          if (shouldReduceData || isLowEndDevice) return

          // Only prefetch if data is not already cached
          const cachedData = queryClient.getQueryData(['user', cast.author.username])
          if (cachedData) return

          // Prefetch user profile with longer stale time
          queryClient.prefetchQuery({
            queryKey: ['user', cast.author.username],
            queryFn: () => fetch(`/api/users/${cast.author.username}`).then(res => res.json()),
            staleTime: 10 * 60 * 1000, // 10 minutes instead of 5
          })
        }}
        className="cursor-pointer"
      >
        {cast.author.pfp_url ? (
          <Image
            src={cast.author.pfp_url}
            alt={cast.author.username}
            width={40}
            height={40}
            sizes="40px"
            quality={80}
            className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:opacity-80 transition-opacity">
            <span className="text-sm font-medium">
              {cast.author.display_name?.[0] || cast.author.username?.[0] || '?'}
            </span>
          </div>
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* name [pro?] [in canal?] tiempo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelectUser?.(cast.author.username)
              }}
              className="text-[15px] font-semibold hover:underline cursor-pointer"
            >
              {cast.author.display_name || cast.author.username}
            </button>
            {(cast.author.power_badge || cast.author.pro?.status === 'subscribed') && <PowerBadge size={16} />}
            {cast.channel && (
              <>
                <span className="text-muted-foreground text-sm">in</span>
                <a
                  href={`https://farcaster.xyz/~/channel/${cast.channel.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  {cast.channel.image_url && (
                    <Image
                      src={cast.channel.image_url}
                      alt=""
                      width={14}
                      height={14}
                      sizes="14px"
                      quality={75}
                      className="w-3.5 h-3.5 rounded-full"
                    />
                  )}
                  <span>{cast.channel.name || cast.channel.id}</span>
                </a>
              </>
            )}
            <span className="text-muted-foreground text-sm">{timeAgo}</span>
          </div>
        </div>

        <Popover open={showMoreMenu} onOpenChange={setShowMoreMenu}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Cast actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="end">
            <button
              onClick={onCopyCastHash}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy cast hash</span>
            </button>
            {isOwnCast ? (
              onDelete ? (
                <button
                  onClick={async () => {
                    await onDelete()
                    setShowMoreMenu(false)
                  }}
                  disabled={isDeleting}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-destructive"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Delete cast</span>
                </button>
              ) : null
            ) : (
              <>
                <button
                  onClick={onMuteUser}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>Mute user</span>
                </button>
                <button
                  onClick={onBlockUser}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  <span>Block user</span>
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export const CastHeader = memo(CastHeaderComponent)
