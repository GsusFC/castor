'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hash, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

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

export function ChannelHeader({ channelId, onBack, signerUuid }: ChannelHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const { data: channel, isLoading } = useQuery<ChannelData>({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      const res = await fetch(`/api/channels/${channelId}`)
      if (!res.ok) throw new Error('Failed to fetch channel')
      const data = await res.json()
      return data.channel
    },
    staleTime: 5 * 60 * 1000,
  })

  const handleFollow = async () => {
    if (!signerUuid) {
      toast.error('Necesitas conectar tu cuenta para seguir canales')
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
        toast.success(isFollowing ? 'Dejaste de seguir el canal' : 'Ahora sigues el canal')
      } else {
        toast.error('Error al actualizar seguimiento')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setFollowLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  if (!channel) return null

  return (
    <div className="mb-6 relative">
      {/* Sticky header con botón volver */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">{channel.name}</span>
        </button>
      </div>

      {/* Banner/Header Image */}
      <div className="h-32 sm:h-40 w-full bg-gradient-to-b from-primary/30 to-primary/10 overflow-hidden rounded-t-lg">
        {channel.header_image_url && (
          <img 
            src={channel.header_image_url} 
            alt="" 
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Content below banner */}
      <div className="px-2 sm:px-4 pb-4 bg-card border-x border-b border-border rounded-b-lg">
        {/* Avatar superpuesto + Stats */}
        <div className="flex justify-between items-end -mt-10 sm:-mt-12 mb-3">
          {/* Avatar */}
          {channel.image_url ? (
            <img 
              src={channel.image_url} 
              alt={channel.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-[4px] border-card bg-card"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-muted border-[4px] border-card flex items-center justify-center">
              <Hash className="w-10 h-10 text-muted-foreground" />
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm mb-2">
            {channel.member_count !== undefined && (
              <div className="text-center">
                <div className="font-bold text-foreground">{channel.member_count.toLocaleString()}</div>
                <div className="text-muted-foreground text-xs">members</div>
              </div>
            )}
            {channel.follower_count !== undefined && (
              <div className="text-center">
                <div className="font-bold text-foreground">{channel.follower_count.toLocaleString()}</div>
                <div className="text-muted-foreground text-xs">followers</div>
              </div>
            )}
          </div>
        </div>

        {/* Channel Info */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                {channel.name.charAt(0).toUpperCase() + channel.name.slice(1).replace(/-/g, ' ')}
              </h1>
              <p className="text-muted-foreground text-sm">/{channel.id}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {signerUuid && (
                <Button 
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  className="rounded-full h-9 px-4 font-medium"
                  onClick={handleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    'Follow'
                  )}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                className="rounded-full h-9 w-9 p-0 hover:bg-muted"
                onClick={() => window.open(`https://warpcast.com/~/channel/${channel.id}`, '_blank')}
                title="Ver en Warpcast"
              >
                <ExternalLink className="w-4 h-4" />
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
