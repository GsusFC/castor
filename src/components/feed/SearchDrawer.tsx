'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, Hash, MessageSquare, Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { useDebounce } from '@/hooks/useDebounce'
import { useUserChannels } from '@/hooks/useUserChannels'
import { useSearch } from '@/context/SearchContext'
import { useMediaQueryBelow } from '@/hooks/useMediaQuery'
import { z } from 'zod'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'

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

const searchResponseSchema = z.object({
    casts: z.array(z.any()),
    users: z.array(z.any()),
    channels: z.array(z.any()),
})

export function SearchDrawer() {
    const router = useRouter()
    const { isOpen, close, open } = useSearch()
    const isMobile = useMediaQueryBelow('sm')
    const [query, setQuery] = useState('')
    const [activeTab, setActiveTab] = useState<SearchTab>('all')
    const { favorites, toggleFavorite } = useUserChannels()
    const [results, setResults] = useState<SearchResult>({ casts: [], users: [], channels: [] })
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const requestIdRef = useRef(0)

    const debouncedQuery = useDebounce(query, 300)

    // Auto-focus input when opening
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }, [isOpen])


    // Keyboard shortcut (Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                open()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open])

    // Search Logic
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults({ casts: [], users: [], channels: [] })
            return
        }

        const requestId = ++requestIdRef.current
        const controller = new AbortController()

        const search = async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=20`, {
                    signal: controller.signal,
                })

                if (!res.ok) {
                    throw new Error('Search failed')
                }

                const json = await res.json()
                const parsed = searchResponseSchema.parse(json)

                if (requestId !== requestIdRef.current) return
                setResults(parsed as unknown as SearchResult)
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return
                console.error('Search error:', error)
                toast.error('Search failed')
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsLoading(false)
                }
            }
        }

        search()
        return () => controller.abort()
    }, [debouncedQuery])

    const handleClear = () => {
        setQuery('')
        setResults({ casts: [], users: [], channels: [] })
        inputRef.current?.focus()
    }

    const onSelectUser = (username: string) => {
        close()
        router.push(`/?user=${encodeURIComponent(username)}`)
    }

    const onSelectCast = (castHash: string) => {
        close()
        router.push(`/?cast=${encodeURIComponent(castHash)}`)
    }

    const onSelectChannel = (channelId: string) => {
        close()
        router.push(`/?channel=${channelId}`)
    }

    const tabs = [
        { id: 'all', label: 'All', icon: Search },
        { id: 'users', label: 'Users', icon: User },
        { id: 'channels', label: 'Channels', icon: Hash },
        { id: 'casts', label: 'Casts', icon: MessageSquare },
    ] as const

    const hasAnyResults = results.users.length > 0 || results.channels.length > 0 || results.casts.length > 0

    const hasResultsForTab =
        activeTab === 'all'
            ? hasAnyResults
            : activeTab === 'users'
                ? results.users.length > 0
                : activeTab === 'channels'
                    ? results.channels.length > 0
                    : results.casts.length > 0

    const shouldShowNoResults = !isLoading && query.length >= 2 && !hasResultsForTab

    const noResultsLabel =
        activeTab === 'all'
            ? 'No results found'
            : activeTab === 'users'
                ? 'No users found'
                : activeTab === 'channels'
                    ? 'No channels found'
                    : 'No casts found'

    return (
        <Sheet open={isOpen} onOpenChange={(val) => !val && close()}>
            <SheetContent
                side={isMobile ? 'bottom' : 'right'}
                className={cn(
                    "p-0 overflow-hidden transition-all duration-300 ease-out border-none [&>button]:hidden",
                    isMobile
                        ? "w-full h-[85dvh] max-h-[85dvh] rounded-t-2xl bg-background text-foreground"
                        : "w-full sm:w-[22vw] sm:min-w-[360px] sm:max-w-[480px] sm:top-4 sm:bottom-4 sm:right-4 sm:h-[calc(100dvh-32px)] sm:rounded-xl sm:bg-background sm:shadow-[0_10px_40px_rgba(0,0,0,0.15)] sm:border sm:border-border/30 text-foreground"
                )}
            >
                <SheetHeader className="sr-only">
                    <SheetTitle>Global Search</SheetTitle>
                </SheetHeader>

                <div className="flex h-full flex-col">
                    {/* Header & Input */}
                    <div className="shrink-0 p-4 border-b border-border bg-card">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search in Castor..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                />
                                {query && (
                                    <button
                                        onClick={handleClear}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted-foreground/20 rounded-full transition-colors"
                                    >
                                        <X className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={close}
                                className="p-2 hover:bg-muted/80 rounded-full transition-colors shrink-0"
                                aria-label="Close search"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-none" role="tablist" aria-label="Search filters">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as SearchTab)}
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap",
                                        activeTab === tab.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                    )}
                                >
                                    <tab.icon className="w-3 h-3" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                <span className="text-xs">Searching...</span>
                            </div>
                        ) : shouldShowNoResults ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                                <Search className="w-10 h-10 mb-3 opacity-20" />
                                <p className="text-sm">{noResultsLabel} for "{query}"</p>
                            </div>
                        ) : !query ? (
                            <div className="p-4">
                                {/* Favorites Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-500" />
                                        <h3 className="text-sm font-semibold text-foreground">Your Favorites</h3>
                                    </div>

                                    {favorites.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {favorites.map((channel) => (
                                                <button
                                                    key={channel.id}
                                                    onClick={() => onSelectChannel(channel.id)}
                                                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left group"
                                                >
                                                    {channel.imageUrl ? (
                                                        <img src={channel.imageUrl} alt="" className="w-6 h-6 rounded object-cover bg-muted" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                                                            <Hash className="w-3 h-3 text-primary" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">/{channel.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                            <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mb-3">
                                                <Star className="w-6 h-6 text-muted-foreground/40" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">No favorite channels yet</p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">Search channels and mark them with ⭐</p>
                                        </div>
                                    )}
                                </div>

                                {/* Quick tip */}
                                <div className="mt-6 pt-4 border-t border-border/50">
                                    <p className="text-xs text-muted-foreground text-center">
                                        Type to search users, channels or casts
                                    </p>
                                </div>
                            </div>

                        ) : (
                            <div className="p-4 space-y-6">
                                {/* Users Section */}
                                {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
                                    <div className="space-y-2">
                                        {activeTab === 'all' && (
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Users</h3>
                                        )}
                                        <div className="space-y-1">
                                            {results.users.map((user) => (
                                                <button
                                                    key={user.fid}
                                                    onClick={() => onSelectUser(user.username)}
                                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                                                >
                                                    {user.pfp_url ? (
                                                        <img src={user.pfp_url} alt="" className="w-10 h-10 rounded-full object-cover bg-muted" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                                            <User className="w-5 h-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">{user.display_name}</span>
                                                            {user.power_badge && <PowerBadge size={14} />}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground truncate block">@{user.username}</span>
                                                    </div>
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
                                                        {(user.follower_count || 0).toLocaleString()} followers
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Channels Section */}
                                {(activeTab === 'all' || activeTab === 'channels') && results.channels.length > 0 && (
                                    <div className="space-y-2">
                                        {activeTab === 'all' && (
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Channels</h3>
                                        )}
                                        <div className="space-y-1">
                                            {results.channels.map((channel) => {
                                                const isFav = favorites.some(f => f.id === channel.id)
                                                return (
                                                    <div key={channel.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                                                        <button
                                                            onClick={() => onSelectChannel(channel.id)}
                                                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                                                        >
                                                            {channel.image_url ? (
                                                                <img src={channel.image_url} alt="" className="w-10 h-10 rounded-md object-cover bg-muted" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                                                                    <Hash className="w-5 h-5 text-muted-foreground" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <span className="font-medium text-sm truncate block text-foreground group-hover:text-primary transition-colors">/{channel.name}</span>
                                                                <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleFavorite({
                                                                    id: channel.id,
                                                                    name: channel.name,
                                                                    imageUrl: channel.image_url
                                                                })
                                                            }}
                                                            className="p-1.5 hover:bg-background rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        >
                                                            <Star className={cn("w-4 h-4 transition-colors", isFav ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground")} />
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Casts Section */}
                                {(activeTab === 'all' || activeTab === 'casts') && results.casts.length > 0 && (
                                    <div className="space-y-2">
                                        {activeTab === 'all' && (
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Casts</h3>
                                        )}
                                        <div className="space-y-2">
                                            {results.casts.map((cast) => (
                                                <button
                                                    key={cast.hash}
                                                    onClick={() => onSelectCast(cast.hash)}
                                                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:border-primary/30 hover:bg-muted/30 transition-all text-left group bg-card/50"
                                                >
                                                    {cast.author.pfp_url ? (
                                                        <img src={cast.author.pfp_url} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover bg-muted" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                            <User className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <span className="text-xs font-medium text-foreground">@{cast.author.username}</span>
                                                            <span className="text-[10px] text-muted-foreground">• {new Date(cast.timestamp).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed group-hover:text-foreground transition-colors">
                                                            {cast.text}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet >
    )
}
