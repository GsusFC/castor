'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface GifResult {
  id: string
  title: string
  images: {
    fixed_height: {
      url: string
      width: string
      height: string
    }
    original: {
      url: string
    }
  }
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void
  onClose: () => void
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState<GifResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY

  // Cargar trending al abrir
  useEffect(() => {
    if (!apiKey) return
    
    const fetchTrending = async () => {
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
        )
        const data = await res.json()
        setTrending(data.data || [])
      } catch (err) {
        console.error('Error fetching trending GIFs:', err)
      }
    }
    
    fetchTrending()
    inputRef.current?.focus()
  }, [apiKey])

  // Buscar con debounce
  useEffect(() => {
    if (!apiKey) return
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setGifs([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        )
        const data = await res.json()
        setGifs(data.data || [])
      } catch (err) {
        console.error('Error searching GIFs:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, apiKey])

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.images.original.url)
    onClose()
  }

  const displayGifs = query.trim() ? gifs : trending

  if (!apiKey) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Configura NEXT_PUBLIC_GIPHY_API_KEY para usar GIFs
      </div>
    )
  }

  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar GIFs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted rounded-md transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Grid */}
      <div className="h-64 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {query.trim() ? 'No se encontraron GIFs' : 'Cargando...'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {displayGifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleSelect(gif)}
                className="relative aspect-video overflow-hidden rounded-md hover:ring-2 hover:ring-castor-brand transition-all group"
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t flex justify-center">
        <img 
          src="https://giphy.com/static/img/poweredby_giphy.png" 
          alt="Powered by GIPHY" 
          className="h-4 opacity-50"
        />
      </div>
    </div>
  )
}
