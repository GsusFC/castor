'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, User, Hash, MessageSquare, Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { useDebounce } from '@/hooks/useDebounce'
import { useUserChannels } from '@/hooks/useUserChannels'

interface SearchResult {
  casts: {
    hash: string
    text: string
    timestamp: string
    author: {
      fid: number
      username: string
      display_name: string
      pfp_url?: string
    }
  }[]
  users: {
    fid: number
    username: string
    display_name: string
    pfp_url?: string
    follower_count: number
    bio?: string
    power_badge?: boolean
  }[]
  channels: {
    id: string
    name: string
    description?: string
    image_url?: string
    follower_count: number
  }[]
}

type SearchTab = 'all' | 'casts' | 'users' | 'channels'

interface GlobalSearchProps {
  onSelectChannel?: (channel: { id: string; name: string; image_url?: string }) => void
  onSelectUser?: (user: { fid: number; username: string }) => void
  onSelectCast?: (cast: { hash: string }) => void
}

export function GlobalSearch({ onSelectChannel, onSelectUser, onSelectCast }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SearchTab>('all')
  const { favorites, toggleFavorite } = useUserChannels()
  const [results, setResults] = useState<SearchResult>({ casts: [], users: [], channels: [] })
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const debouncedQuery = useDebounce(query, 300)

  // Búsqueda
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults({ casts: [], users: [], channels: [] })
      return
    }

    const search = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&type=${activeTab}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    search()
  }, [debouncedQuery, activeTab])

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClear = () => {
    setQuery('')
    setResults({ casts: [], users: [], channels: [] })
    inputRef.current?.focus()
  }

  const hasResults = results.casts.length > 0 || results.users.length > 0 || results.channels.length > 0
  const showDropdown = isOpen && (query.length >= 2 || hasResults)

  const tabs: { value: SearchTab; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todo', icon: <Search className="w-3 h-3" /> },
    { value: 'casts', label: 'Casts', icon: <MessageSquare className="w-3 h-3" /> },
    { value: 'users', label: 'Usuarios', icon: <User className="w-3 h-3" /> },
    { value: 'channels', label: 'Canales', icon: <Hash className="w-3 h-3" /> },
  ]

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar... (⌘K)"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-border bg-muted/50 focus:bg-background focus:border-primary/50 focus:outline-none transition-colors"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === tab.value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Results - scroll oculto */}
          <div className="max-h-64 overflow-y-auto scrollbar-none">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !hasResults && query.length >= 2 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No se encontraron resultados
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Users */}
                {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                        Usuarios
                      </div>
                    )}
                    {results.users.map((user) => (
                      <button
                        key={user.fid}
                        onClick={() => {
                          onSelectUser?.(user)
                          setIsOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                      >
                        {user.pfp_url ? (
                          <img src={user.pfp_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-sm truncate">{user.display_name}</span>
                            {user.power_badge && <PowerBadge size={14} />}
                          </div>
                          <span className="text-xs text-muted-foreground">@{user.username}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{user.follower_count} seg.</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Channels */}
                {(activeTab === 'all' || activeTab === 'channels') && results.channels.length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                        Canales
                      </div>
                    )}
                    {results.channels.map((channel) => {
                      const isFav = favorites.some(f => f.id === channel.id)
                      return (
                        <div
                          key={channel.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                        >
                          <button
                            onClick={() => {
                              onSelectChannel?.(channel)
                              setIsOpen(false)
                            }}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            {channel.image_url ? (
                              <img src={channel.image_url} alt="" className="w-8 h-8 rounded" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Hash className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm truncate">/{channel.name}</span>
                              {channel.description && (
                                <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{channel.follower_count} seg.</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite({ id: channel.id, name: channel.name, imageUrl: channel.image_url })
                            }}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                          >
                            <Star className={cn("w-4 h-4", isFav ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground")} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Casts */}
                {(activeTab === 'all' || activeTab === 'casts') && results.casts.length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                        Casts
                      </div>
                    )}
                    {results.casts.map((cast) => (
                      <button
                        key={cast.hash}
                        onClick={() => {
                          onSelectCast?.(cast)
                          setIsOpen(false)
                        }}
                        className="w-full flex items-start gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                      >
                        {cast.author.pfp_url ? (
                          <img src={cast.author.pfp_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs font-medium">@{cast.author.username}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{cast.text}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
