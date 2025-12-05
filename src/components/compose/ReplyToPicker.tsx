'use client'

import { useState } from 'react'
import { MessageSquare, X, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CastInfo {
  hash: string
  text: string
  author: {
    fid: number
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
  timestamp: string
}

interface ReplyToPickerProps {
  replyTo: CastInfo | null
  onSelect: (cast: CastInfo | null) => void
}

export function ReplyToPicker({ replyTo, onSelect }: ReplyToPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!url.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/casts/lookup?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Cast no encontrado')
      }

      onSelect(data.cast)
      setUrl('')
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar cast')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleLookup()
    }
  }

  // Si ya hay un cast seleccionado, mostrar preview
  if (replyTo) {
    return (
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
        <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {replyTo.author.pfpUrl && (
              <img
                src={replyTo.author.pfpUrl}
                alt=""
                className="w-5 h-5 rounded-full"
              />
            )}
            <span className="text-sm font-medium text-gray-900">
              {replyTo.author.displayName || replyTo.author.username}
            </span>
            <span className="text-xs text-gray-500">
              @{replyTo.author.username}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{replyTo.text}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSelect(null)}
          className="h-6 w-6 shrink-0 text-gray-400 hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  // Botón para abrir el picker
  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-gray-500"
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        Responder a un cast
      </Button>
    )
  }

  // Input para buscar cast
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pega la URL del cast de Warpcast..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          type="button"
          onClick={handleLookup}
          disabled={isLoading || !url.trim()}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Buscar'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsOpen(false)
            setUrl('')
            setError(null)
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      
      <p className="text-xs text-gray-500">
        Ejemplo: https://warpcast.com/dwr.eth/0x1234...
      </p>
    </div>
  )
}
