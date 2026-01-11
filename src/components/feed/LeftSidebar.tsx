'use client'

import { useState, useEffect } from 'react'
import { Star, Loader2, TrendingUp, Plus } from 'lucide-react'
import { ChannelItem } from './ChannelItem'
import { CONTENT } from '@/lib/spacing-system'
import { cn } from '@/lib/utils'

interface Channel {
  id: string
  name: string
  image_url?: string
  follower_count?: number
}

interface LeftSidebarProps {
  onSelectChannel?: (channel: Channel) => void
}

export function LeftSidebar({ onSelectChannel }: LeftSidebarProps) {
  const [userChannels, setUserChannels] = useState<Channel[]>([])
  const [trendingChannels, setTrendingChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAllUserChannels, setShowAllUserChannels] = useState(false)
  const [showAllTrending, setShowAllTrending] = useState(false)

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        // Fetch user channels
        const userRes = await fetch('/api/channels/user?limit=100')
        if (userRes.ok) {
          const userData = await userRes.json()
          setUserChannels(userData.channels || [])
        }

        // Fetch trending channels
        const trendingRes = await fetch('/api/channels/trending?limit=10')
        if (trendingRes.ok) {
          const trendingData = await trendingRes.json()
          setTrendingChannels(trendingData.channels || [])
        }
      } catch (error) {
        console.error('Error fetching channels:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [])

  const displayUserChannels = showAllUserChannels 
    ? userChannels 
    : userChannels.slice(0, 5)

  const displayTrendingChannels = showAllTrending 
    ? trendingChannels 
    : trendingChannels.slice(0, 5)

  return (
    <aside className="sticky top-20 space-y-6 sm:space-y-8">
      {/* Mis Canales */}
      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="flex items-center gap-2.5 text-sm sm:text-base font-semibold text-foreground">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
              <Star className="w-4 h-4 text-yellow-500" />
            </span>
            Mis Canales
          </h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : userChannels.length > 0 ? (
          <>
            <ul className={cn('space-y-3 sm:space-y-4')}>
              {displayUserChannels.filter((c: Channel) => c.id).map((channel: Channel, idx: number) => (
                <li key={`user-${channel.id || idx}`}>
                  <ChannelItem
                    channel={channel}
                    onClick={() => onSelectChannel?.(channel)}
                    variant="default"
                    showMeta={true}
                  />
                </li>
              ))}
            </ul>
            {userChannels.length > 5 && (
              <button
                onClick={() => setShowAllUserChannels(!showAllUserChannels)}
                className="w-full mt-4 sm:mt-5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                {showAllUserChannels ? 'Ver menos' : `Ver todos (${userChannels.length})`}
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-6 sm:py-8 bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              No sigues ningún canal
            </p>
          </div>
        )}
      </section>

      {/* Canales Trending */}
      <section className="border-t border-border/50 pt-6 sm:pt-8">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="flex items-center gap-2.5 text-sm sm:text-base font-semibold text-foreground">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20">
              <TrendingUp className="w-4 h-4 text-orange-500" />
            </span>
            Trending
          </h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : trendingChannels.length > 0 ? (
          <>
            <ul className={cn('space-y-3 sm:space-y-4')}>
              {displayTrendingChannels.filter((c: Channel) => c.id).map((channel: Channel, idx: number) => (
                <li key={`trending-${channel.id || idx}`}>
                  <ChannelItem
                    channel={channel}
                    onClick={() => onSelectChannel?.(channel)}
                    variant="default"
                    showMeta={true}
                  />
                </li>
              ))}
            </ul>
            {trendingChannels.length > 5 && (
              <button
                onClick={() => setShowAllTrending(!showAllTrending)}
                className="w-full mt-4 sm:mt-5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                {showAllTrending ? 'Ver menos' : `Ver todos (${trendingChannels.length})`}
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-6 sm:py-8 bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              No hay canales trending
            </p>
          </div>
        )}
      </section>
    </aside>
  )
}
