'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hash, ExternalLink, Loader2, Heart, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ViewHeader } from '@/components/ui/ViewHeader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HERO, CARD, ACTIONS, CONTENT } from '@/lib/spacing-system'

interface ChannelHeaderProps {
  channelId: string
  onBack: () => void
  signerUuid?: string
}

interface ChannelData {
  id: string
  name: string
  image_url?: string
  header_image_url?: string
  description?: string
  follower_count?: number
  member_count?: number
}

interface ChannelResponse {
  channel: ChannelData
  viewerContext?: { following: boolean }
}

export function ChannelHeader({ channelId, onBack, signerUuid }: ChannelHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const { data, isLoading } = useQuery<ChannelResponse>({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      const res = await fetch(`/api/channels/${channelId}`)
      if (!res.ok) throw new Error('Failed to fetch channel')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const channel = data?.channel
  const channelName = channel?.name
    ? channel.name.charAt(0).toUpperCase() + channel.name.slice(1).replace(/-/g, ' ')
    : ''

  useEffect(() => {
    if (data?.viewerContext?.following !== undefined) {
      setIsFollowing(data.viewerContext.following)
    }
  }, [data?.viewerContext?.following])

  const handleFollow = async () => {
    if (!signerUuid) {
      toast.error('Connect your account to follow channels')
      return
    }

    setFollowLoading(true)
    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`/api/channels/${channelId}/follow`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerUuid }),
      })

      if (res.ok) {
        setIsFollowing(!isFollowing)
        toast.success(isFollowing ? 'Unfollowed channel' : 'Now following channel')
      } else {
        toast.error('Failed to update follow status')
      }
    } catch {
      toast.error('Connection error')
    } finally {
      setFollowLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className={cn(HERO.BANNER.CHANNEL, "bg-muted animate-pulse rounded-lg")} />
      </div>
    )
  }

  if (!channel) return null

  return (
    <div className="mb-6 relative">
      <ViewHeader
        title={channelName}
        onBack={onBack}
      />

      {/* Banner/Header Image - Larger for more impact */}
      <div className={cn(
        "bg-gradient-to-b from-primary/30 to-primary/10 overflow-hidden rounded-t-lg mx-3 sm:mx-4 lg:mx-6",
        HERO.BANNER.CHANNEL
      )}>
        {channel.header_image_url && (
          <img
            src={channel.header_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Card Container */}
      <div className={cn(
        "bg-card border-x border-b border-border rounded-b-lg mx-3 sm:mx-4 lg:mx-6",
        CARD.PROFILE
      )}>
        {/* Avatar Row + Stats - Proportional offset */}
        <div className={cn(
          "flex justify-between items-end gap-6 sm:gap-8 px-4 sm:px-6",
          HERO.AVATAR_OFFSET.STANDARD,
          "mb-6 sm:mb-8"
        )}>
          {/* Avatar */}
          <div className="flex-shrink-0">
            {channel.image_url ? (
              <img
                src={channel.image_url}
                alt={channel.name}
                className={cn(
                  "rounded-full object-cover",
                  HERO.AVATAR_SIZE.STANDARD,
                  HERO.AVATAR_BORDER,
                  "bg-card"
                )}
              />
            ) : (
              <div className={cn(
                "rounded-full bg-muted border-[4px] border-card flex items-center justify-center",
                HERO.AVATAR_SIZE.STANDARD
              )}>
                <Hash className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Stats - Better positioned */}
          <div className={cn("flex items-center gap-6 sm:gap-8 text-sm")}>
            {channel.member_count !== undefined && (
              <div className="text-right">
                <div className="font-bold text-foreground text-lg">
                  {channel.member_count.toLocaleString()}
                </div>
                <div className="text-muted-foreground text-xs">members</div>
              </div>
            )}
            {channel.follower_count !== undefined && (
              <div className="text-right">
                <div className="font-bold text-foreground text-lg">
                  {channel.follower_count.toLocaleString()}
                </div>
                <div className="text-muted-foreground text-xs">followers</div>
              </div>
            )}
          </div>
        </div>

        {/* Channel Info Section */}
        <div className={cn(
          "space-y-3 sm:space-y-4 pb-6 sm:pb-8 border-b border-border/50 px-4 sm:px-6"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                {channelName}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">/{channel.id}</p>
            </div>

            {/* Actions - Separate section */}
            <div className={cn("flex items-center flex-shrink-0", ACTIONS.CONTAINER_GENEROUS)}>
              {signerUuid && (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  className={cn(
                    "rounded-full",
                    ACTIONS.PRIMARY_BUTTON.height,
                    ACTIONS.PRIMARY_BUTTON.padding,
                    ACTIONS.PRIMARY_BUTTON.text,
                    "flex items-center",
                    ACTIONS.PRIMARY_BUTTON.gap,
                    "transition-all hover:shadow-md"
                  )}
                  onClick={handleFollow}
                  disabled={followLoading}
                  title={isFollowing ? "Unfollow this channel" : "Join this community"}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <>
                      <Heart className={cn(
                        "w-4 h-4 sm:w-5 sm:h-5",
                        isFollowing ? "fill-current" : ""
                      )} />
                      <span>{isFollowing ? 'Following' : 'Follow'}</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                className={cn(
                  "rounded-full",
                  ACTIONS.SECONDARY_BUTTON.height,
                  ACTIONS.SECONDARY_BUTTON.padding,
                  ACTIONS.SECONDARY_BUTTON.text,
                  "flex items-center",
                  ACTIONS.SECONDARY_BUTTON.gap,
                  "transition-all hover:bg-muted"
                )}
                onClick={() => {
                  window.open(`https://warpcast.com/~/channel/${channel.id}`, '_blank')
                  toast.success('Opened in Warpcast')
                }}
                title="View on Warpcast"
              >
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </div>

          {/* Description */}
          {channel.description && (
            <p className="text-sm sm:text-[15px] text-foreground/80 leading-relaxed">
              {channel.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
