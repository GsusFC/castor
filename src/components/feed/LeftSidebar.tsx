'use client'

import { useState, useEffect } from 'react'
import { Hash, Star, ChevronRight, Loader2, TrendingUp } from 'lucide-react'

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
    <aside className="sticky top-20 space-y-6">
      {/* Mis Canales */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Star className="w-4 h-4 text-yellow-500" />
          Mis Canales
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : userChannels.length > 0 ? (
          <>
            <ul className="space-y-1">
              {displayUserChannels.filter((c: Channel) => c.id).map((channel: Channel, idx: number) => (
                <li key={`user-${channel.id || idx}`}>
                  <button
                    onClick={() => onSelectChannel?.(channel)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-sm group text-left"
                  >
                    {channel.image_url ? (
                      <img 
                        src={channel.image_url} 
                        alt={channel.name}
                        className="w-5 h-5 rounded"
                      />
                    ) : (
                      <Hash className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{channel.name}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              ))}
            </ul>
            {userChannels.length > 5 && (
              <button
                onClick={() => setShowAllUserChannels(!showAllUserChannels)}
                className="w-full mt-2 px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                {showAllUserChannels ? 'Ver menos' : `Ver todos (${userChannels.length})`}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground px-2">
            No sigues ningún canal
          </p>
        )}
      </section>

      {/* Canales Trending */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          Trending
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ul className="space-y-1">
              {displayTrendingChannels.filter((c: Channel) => c.id).map((channel: Channel, idx: number) => (
                <li key={`trending-${channel.id || idx}`}>
                  <button
                    onClick={() => onSelectChannel?.(channel)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-sm group text-left"
                  >
                    {channel.image_url ? (
                      <img 
                        src={channel.image_url} 
                        alt={channel.name}
                        className="w-5 h-5 rounded"
                      />
                    ) : (
                      <Hash className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{channel.name}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              ))}
            </ul>
            {trendingChannels.length > 5 && (
              <button
                onClick={() => setShowAllTrending(!showAllTrending)}
                className="w-full mt-2 px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                {showAllTrending ? 'Ver menos' : `Ver todos (${trendingChannels.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </aside>
  )
}
