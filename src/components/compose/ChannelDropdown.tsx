'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Hash, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Channel } from './types'

interface ChannelDropdownProps {
  selectedChannel: Channel | null
  onSelect: (channel: Channel | null) => void
  accountFid?: number
}

export function ChannelDropdown({
  selectedChannel,
  onSelect,
  accountFid,
}: ChannelDropdownProps) {
  const [open, setOpen] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    const loadChannels = async () => {
      setIsLoading(true)
      try {
        let url = '/api/channels'
        if (search.length >= 2) {
          url = `/api/channels?q=${encodeURIComponent(search)}`
        } else if (accountFid) {
          url = `/api/channels?fid=${accountFid}`
        }
        const res = await fetch(url)
        const data = await res.json()
        setChannels(data.channels || [])
      } catch {
        setChannels([])
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(loadChannels, 300)
    return () => clearTimeout(timer)
  }, [open, search, accountFid])

  const handleSelect = (channel: Channel | null) => {
    onSelect(channel)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1", !selectedChannel && "text-muted-foreground")}
          aria-label={selectedChannel ? `Canal: ${selectedChannel.name}` : 'Seleccionar canal'}
        >
          {selectedChannel?.imageUrl ? (
            <img
              src={selectedChannel.imageUrl}
              alt=""
              className="w-4 h-4 rounded object-cover"
            />
          ) : (
            <Hash className="w-3 h-3" />
          )}
          <span className="max-w-[80px] truncate">
            {selectedChannel ? selectedChannel.name : 'Canal'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {/* Buscador */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channel..."
              className="pl-8 h-8"
              aria-label="Buscar canal"
            />
          </div>
        </div>

        {/* Lista de canales */}
        <div className="max-h-60 overflow-y-auto p-1">
          {/* Opción para quitar canal */}
          {selectedChannel && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              Remove channel
            </button>
          )}

          {/* Estados de carga y vacío */}
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.length >= 2 ? 'No results' : 'Type to search'}
            </p>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => handleSelect(channel)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  selectedChannel?.id === channel.id && "bg-muted"
                )}
              >
                {channel.imageUrl ? (
                  <img
                    src={channel.imageUrl}
                    alt=""
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                    <Hash className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate">{channel.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
