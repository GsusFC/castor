import { useState, useEffect, useRef, useCallback } from 'react'
import { Hash, ChevronDown, Loader2, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Channel {
  id: string
  name: string
  imageUrl?: string
}

interface ChannelPickerProps {
  selectedChannel: Channel | null
  onSelect: (channel: Channel | null) => void
  accountFid?: number
}

export function ChannelPicker({ selectedChannel, onSelect, accountFid }: ChannelPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Cargar canales
  const loadChannels = useCallback(async (query?: string) => {
    setIsLoading(true)
    try {
      let url = '/api/channels'
      if (query && query.length >= 2) {
        url = `/api/channels?q=${encodeURIComponent(query)}`
      } else if (accountFid) {
        url = `/api/channels?fid=${accountFid}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setChannels(data.channels || [])
    } catch (err) {
      console.error('Error loading channels:', err)
      setChannels([])
    } finally {
      setIsLoading(false)
    }
  }, [accountFid])

  // Cargar al abrir
  useEffect(() => {
    if (isOpen) {
      loadChannels(search)
    }
  }, [isOpen, accountFid, loadChannels])

  // Debounce search
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      loadChannels(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, loadChannels, isOpen])

  return (
    <Card className="p-4">
      <label className="block text-sm font-medium text-gray-700 mb-3">Canal (opcional)</label>
      <div className="relative" ref={pickerRef}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full justify-between h-auto py-3 px-3 font-normal",
            !selectedChannel && "text-gray-500"
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {selectedChannel ? (
              <span className="font-medium truncate text-gray-900">{selectedChannel.name}</span>
            ) : (
              <span>Seleccionar canal</span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
        </Button>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col">
            <div className="p-2 border-b bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar canal..."
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 min-h-[100px]">
              {selectedChannel && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect(null)
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-destructive hover:bg-red-50 border-b flex items-center gap-2 transition-colors"
                >
                  <Hash className="w-4 h-4" />
                  Quitar canal
                </button>
              )}
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-xs">Cargando canales...</span>
                </div>
              ) : channels.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No se encontraron canales
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => {
                        onSelect(channel)
                        setIsOpen(false)
                        setSearch('')
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors",
                        selectedChannel?.id === channel.id && "bg-blue-50"
                      )}
                    >
                      {channel.imageUrl ? (
                        <img src={channel.imageUrl} alt="" className="w-8 h-8 rounded object-cover border" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center border">
                          <Hash className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{channel.name}</p>
                        <p className="text-xs text-gray-500 truncate">/{channel.id}</p>
                      </div>
                      {selectedChannel?.id === channel.id && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
