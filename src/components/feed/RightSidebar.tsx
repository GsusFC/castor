'use client'

import { useState, useEffect } from 'react'
import { UserPlus, TrendingUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuggestedUser {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  follower_count?: number
}

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

export function RightSidebar() {
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([])
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
    <aside className="sticky top-20 space-y-6">
      {/* Who to follow */}
      <section className="p-4 rounded-xl bg-muted/30 border border-border">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          A quién seguir
        </h3>
        {suggestedUsers.length > 0 ? (
          <ul className="space-y-3">
            {suggestedUsers.map((user) => (
              <li key={user.fid} className="flex items-center gap-3">
                {user.pfp_url ? (
                  <img 
                    src={user.pfp_url} 
                    alt={user.username}
                    className="w-9 h-9 rounded-full"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {user.display_name?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                </div>
                <button className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors">
                  Seguir
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Próximamente sugerencias personalizadas
          </p>
        )}
      </section>

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
                <a
                  href={`https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
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
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No hay trending</p>
        )}
      </section>

      {/* Footer links */}
      <div className="text-[10px] text-muted-foreground space-x-2 px-2">
        <a href="#" className="hover:underline">Términos</a>
        <span>·</span>
        <a href="#" className="hover:underline">Privacidad</a>
        <span>·</span>
        <a href="#" className="hover:underline">Ayuda</a>
        <span>·</span>
        <span>© 2025 Castor</span>
      </div>
    </aside>
  )
}
