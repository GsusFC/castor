'use client'

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
}: MobileNavSearchSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] flex flex-col p-0" aria-describedby={undefined}>
        <SheetHeader className="sr-only">
          <SheetTitle>Buscar</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          {!searchQuery && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Search</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Usuarios, canales y casts
              </p>
            </div>
          )}

          {isSearching && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSearching && searchQuery.length >= 2 &&
            searchResults.users.length === 0 &&
            searchResults.channels.length === 0 &&
            searchResults.casts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron resultados
            </div>
          )}

          {!isSearching && (searchResults.users.length > 0 || searchResults.channels.length > 0 || searchResults.casts.length > 0) && (
            <div className="space-y-6">
              {searchResults.users.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuarios</p>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1">
                    {searchResults.users.map((user: any) => (
                      <button
                        key={user.fid}
                        onClick={() => onSelectUser(user.username)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        {user.pfp_url ? (
                          <img src={user.pfp_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-sm truncate">{user.display_name}</span>
                            {user.power_badge && <PowerBadge size={14} />}
                          </div>
                          <span className="text-xs text-muted-foreground">@{user.username}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{user.follower_count?.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.channels.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Canales</p>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1">
                    {searchResults.channels.map((channel: any) => {
                      const isFav = favorites.some(f => f.id === channel.id)

                      return (
                        <div
                          key={channel.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                          <button
                            onClick={() => onSelectChannel(channel.id)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            {channel.image_url ? (
                              <img src={channel.image_url} alt="" className="w-10 h-10 rounded-lg" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Hash className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">/{channel.name || channel.id}</span>
                              {channel.description && (
                                <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{channel.follower_count?.toLocaleString()}</span>
                          </button>
                          <button
                            onClick={() => toggleFavorite({
                              id: channel.id,
                              name: channel.name || channel.id,
                              imageUrl: channel.image_url ?? undefined,
                              isFavorite: isFav,
                            })}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          >
                            <Star className={cn('w-4 h-4', isFav ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground')} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {searchResults.casts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Casts</p>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1">
                    {searchResults.casts.map((cast: any) => (
                      <button
                        key={cast.hash}
                        onClick={() => onSelectUser(cast.author?.username)}
                        className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        {cast.author?.pfp_url ? (
                          <img src={cast.author.pfp_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">@{cast.author?.username}</span>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{cast.text}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-border bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              autoFocus
              className="w-full pl-11 pr-10 py-3 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                aria-label="Limpiar búsqueda"
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
