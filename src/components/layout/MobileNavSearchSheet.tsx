'use client'

import { useState } from 'react'

import { Hash, Loader2, Search, Star, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PowerBadge } from '@/components/ui/PowerBadge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface MobileNavSearchSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searchResults: {
    users: any[]
    channels: any[]
    casts: any[]
  }
  isSearching: boolean
  favorites: Array<{ id: string }>
  toggleFavorite: (channel: { id: string; name: string; imageUrl?: string; isFavorite?: boolean }) => Promise<void>
  onSelectUser: (username: string) => void
  onSelectChannel: (channelId: string) => void
  onSelectCast: (castHash: string) => void
}

export function MobileNavSearchSheet({
  open,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
  favorites,
  toggleFavorite,
  onSelectUser,
  onSelectChannel,
  onSelectCast,
}: MobileNavSearchSheetProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'channels' | 'casts'>('all')

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'Users' },
    { id: 'channels', label: 'Channels' },
    { id: 'casts', label: 'Casts' },
  ] as const

  const hasAnyResults =
    searchResults.users.length > 0 || searchResults.channels.length > 0 || searchResults.casts.length > 0

  const hasResultsForTab =
    activeTab === 'all'
      ? hasAnyResults
      : activeTab === 'users'
        ? searchResults.users.length > 0
        : activeTab === 'channels'
          ? searchResults.channels.length > 0
          : searchResults.casts.length > 0

  const shouldShowNoResults = !isSearching && searchQuery.length >= 2 && !hasResultsForTab

  const noResultsLabel =
    activeTab === 'all'
      ? 'No results found'
      : activeTab === 'users'
        ? 'No users found'
        : activeTab === 'channels'
          ? 'No channels found'
          : 'No casts found'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] flex flex-col p-0" aria-describedby={undefined}>
        <SheetHeader className="sr-only">
          <SheetTitle>Search</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          {!searchQuery && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Search</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Users, channels and casts
              </p>
            </div>
          )}

          {isSearching && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {shouldShowNoResults && (
            <div className="text-center py-12 text-muted-foreground">
              {noResultsLabel}
            </div>
          )}

          {!isSearching && !shouldShowNoResults && hasAnyResults && (
            <div className="space-y-6 pb-4">
              {/* Users */}
              {(activeTab === 'all' || activeTab === 'users') && searchResults.users.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Users</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="space-y-1">
                    {searchResults.users.map((user: any) => (
                      <button
                        key={user.fid}
                        onClick={() => onSelectUser(user.username)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        {user.pfp_url ? (
                          <img src={user.pfp_url} alt="" className="w-10 h-10 rounded-full object-cover bg-muted" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-sm truncate">{user.display_name}</span>
                            {user.power_badge && <PowerBadge size={14} />}
                          </div>
                          <span className="text-xs text-muted-foreground truncate block">@{user.username}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{user.follower_count?.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels */}
              {(activeTab === 'all' || activeTab === 'channels') && searchResults.channels.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Channels</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="space-y-1">
                    {searchResults.channels.map((channel: any) => {
                      const isFav = favorites.some(f => f.id === channel.id)

                      return (
                        <div
                          key={channel.id}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full overflow-hidden"
                        >
                          <button
                            onClick={() => onSelectChannel(channel.id)}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                          >
                            {channel.image_url ? (
                              <img src={channel.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Hash className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm truncate block">/{channel.name || channel.id}</span>
                              {channel.description && (
                                <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                              )}
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground tabular-nums">{channel.follower_count?.toLocaleString()}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite({
                                  id: channel.id,
                                  name: channel.name || channel.id,
                                  imageUrl: channel.image_url ?? undefined,
                                  isFavorite: isFav,
                                })
                              }}
                              className="p-2 hover:bg-muted rounded-full transition-colors"
                              aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Star className={cn('w-4 h-4', isFav ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground')} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Casts */}
              {(activeTab === 'all' || activeTab === 'casts') && searchResults.casts.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Casts</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="space-y-1">
                    {searchResults.casts.map((cast: any) => (
                      <button
                        key={cast.hash}
                        onClick={() => onSelectCast(cast.hash)}
                        className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        {cast.author?.pfp_url ? (
                          <img src={cast.author.pfp_url} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover bg-muted" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block">@{cast.author?.username}</span>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5 break-words">{cast.text}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 pt-2 pb-3 px-4 border-t border-border bg-card">
          {/* Tabs - Pills style */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-none pb-1" role="tablist" aria-label="Search filters">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              autoFocus
              className="w-full pl-11 pr-10 py-3 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
