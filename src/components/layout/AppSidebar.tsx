'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useUserChannels } from '@/hooks/useUserChannels'
import { 
  Newspaper, 
  Calendar, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  Plus,
  Hash,
  Search,
  Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'

const NAV_ITEMS = [
  { href: '/', label: 'Feed', icon: Newspaper },
  { href: '/studio', label: 'Studio', icon: Calendar },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/accounts', label: 'Accounts', icon: Users },
]

interface Channel {
  id: string
  name: string
  imageUrl?: string
  isFavorite?: boolean
}

function ChannelItem({ 
  channel, 
  onToggleFavorite 
}: { 
  channel: Channel
  onToggleFavorite: (channel: Channel) => void 
}) {
  return (
    <li className="group">
      <Link
        href={`/?channel=${channel.id}`}
        className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {channel.imageUrl ? (
          <img src={channel.imageUrl} alt="" className="w-5 h-5 rounded-full" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <Hash className="w-3 h-3" />
          </div>
        )}
        <span className="truncate flex-1">{channel.name}</span>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite(channel)
          }}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-0.5",
            channel.isFavorite && "opacity-100"
          )}
        >
          <Star 
            className={cn(
              "w-3.5 h-3.5",
              channel.isFavorite 
                ? "fill-yellow-500 text-yellow-500" 
                : "text-muted-foreground hover:text-yellow-500"
            )} 
          />
        </button>
      </Link>
    </li>
  )
}


export function AppSidebar() {
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)
  const [channelSearch, setChannelSearch] = useState('')
  const { channels, favorites, recent, isLoading: channelsLoading, toggleFavorite } = useUserChannels()

  const allChannels = useMemo(() => [
    ...favorites,
    ...recent,
    ...channels,
  ], [favorites, recent, channels])

  const filteredChannels = useMemo(() => {
    if (!channelSearch.trim()) return null
    return allChannels.filter(c => 
      c.name.toLowerCase().includes(channelSearch.toLowerCase())
    )
  }, [allChannels, channelSearch])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0 border-r border-border/50 bg-background/50 backdrop-blur-sm">
        {/* Logo */}
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <img src="/brand/logo.png" alt="Castor" className="w-8 h-8" />
            <span className="font-semibold text-lg">Castor</span>
          </Link>
        </div>

        {/* New Cast Button */}
        <div className="px-4 mb-4">
          <Button 
            onClick={() => setComposeOpen(true)}
            className="w-full justify-center gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            New Cast
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 flex flex-col min-h-0 overflow-hidden">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/' 
                ? pathname === '/'
                : pathname.startsWith(item.href)
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Channels Section */}
          <div className="mt-6 flex-1 flex flex-col min-h-0">
            {/* Search */}
            {allChannels.length > 5 && (
              <div className="px-3 mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search channels..."
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    className="w-full h-7 pl-7 pr-2 text-xs rounded-md bg-muted/50 border-0 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
            )}
            {channelsLoading ? (
              <div className="px-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-5 w-20 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : allChannels.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No sigues ningún canal
              </p>
            ) : filteredChannels ? (
              // Search results
              <ul className="space-y-0.5 overflow-y-auto no-scrollbar flex-1">
                {filteredChannels.map((channel) => (
                  <ChannelItem 
                    key={channel.id} 
                    channel={channel} 
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
                {filteredChannels.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    No channels found
                  </li>
                )}
              </ul>
            ) : (
              // Sectioned view
              <div className="overflow-y-auto no-scrollbar flex-1 space-y-4">
                {/* Favorites */}
                {favorites.length > 0 && (
                  <div>
                    <h4 className="px-3 mb-1 text-xs font-medium text-muted-foreground">Favorites</h4>
                    <ul className="space-y-0.5">
                      {favorites.map((channel) => (
                        <ChannelItem 
                          key={channel.id} 
                          channel={channel} 
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                {/* Recent */}
                {recent.length > 0 && (
                  <div>
                    <h4 className="px-3 mb-1 text-xs font-medium text-muted-foreground">Recent</h4>
                    <ul className="space-y-0.5">
                      {recent.map((channel) => (
                        <ChannelItem 
                          key={channel.id} 
                          channel={channel} 
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                {/* All */}
                {channels.length > 0 && (
                  <div>
                    <h4 className="px-3 mb-1 text-xs font-medium text-muted-foreground">All</h4>
                    <ul className="space-y-0.5">
                      {channels.map((channel) => (
                        <ChannelItem 
                          key={channel.id} 
                          channel={channel} 
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Configuración"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <ComposeModal 
        open={composeOpen} 
        onOpenChange={setComposeOpen}
      />
    </>
  )
}
