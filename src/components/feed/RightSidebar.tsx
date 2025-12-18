'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Loader2 } from 'lucide-react'
import { GlobalSearch } from '@/components/feed/GlobalSearch'

interface TrendingCast {
  hash: string
  text: string
  author: {
    username: string
    display_name: string
    pfp_url?: string
  }
  reactions: {
    likes_count: number
  }
}

interface RightSidebarProps {
  onSelectUser?: (username: string) => void
  onSelectCast?: (castHash: string) => void
}

export function RightSidebar({ onSelectUser, onSelectCast }: RightSidebarProps) {
  const router = useRouter()
  const [trendingCasts, setTrendingCasts] = useState<TrendingCast[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch trending casts for "what's hot"
        const res = await fetch('/api/feed?type=trending&limit=3')
        if (res.ok) {
          const data = await res.json()
          setTrendingCasts(data.casts || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <aside className="space-y-6">
      {/* Search */}
      <GlobalSearch
        onSelectUser={(user) => {
          if (onSelectUser) {
            onSelectUser(user.username)
          } else {
            router.push(`/user/${user.username}`)
          }
        }}
        onSelectChannel={(channel) => router.push(`/?channel=${channel.id}`)}
        onSelectCast={(cast) => {
          if (onSelectCast) {
            onSelectCast(cast.hash)
            return
          }
          router.push(`/cast/${cast.hash}`)
        }}
      />

      {/* Trending */}
      <section className="p-4 rounded-xl bg-muted/30 border border-border">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          Trending
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : trendingCasts.length > 0 ? (
          <ul className="space-y-3">
            {trendingCasts.map((cast) => (
              <li key={cast.hash}>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectCast) {
                      onSelectCast(cast.hash)
                      return
                    }
                    router.push(`/cast/${cast.hash}`)
                  }}
                  className="block w-full text-left p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  aria-label={`Open conversation by @${cast.author.username}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {cast.author.pfp_url && (
                      <img
                        src={cast.author.pfp_url}
                        alt={cast.author.username}
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      @{cast.author.username}
                    </span>
                    <span className="text-xs text-pink-500">
                      ❤️ {cast.reactions.likes_count}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-2">{cast.text}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No trending casts</p>
        )}
      </section>

      {/* Footer links */}
      <div className="text-[10px] text-muted-foreground space-x-2 px-2">
        <a href="#" className="hover:underline">Terms</a>
        <span>·</span>
        <a href="#" className="hover:underline">Privacy</a>
        <span>·</span>
        <a href="#" className="hover:underline">Help</a>
        <span>·</span>
        <span>© 2025 Castor</span>
      </div>
    </aside>
  )
}
