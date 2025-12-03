import { useRef, useState, useEffect, useCallback } from 'react'
import { Image, Smile, X, Trash2, Loader2 } from 'lucide-react'
import { CastItem, MediaFile, LinkEmbed } from './types'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GifPicker } from './GifPicker'
import { LinkPreview } from './LinkPreview'
import { MentionAutocomplete } from './MentionAutocomplete'
import { extractUrls, isMediaUrl, calculateTextLength } from '@/lib/url-utils'

const EMOJI_LIST = [
  '😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😅', '🙌', '👏',
  '🔥', '💯', '✨', '🚀', '💪', '🎉', '❤️', '💜', '💙', '💚',
  '👀', '🙏', '💡', '⚡', '🌟', '🎯', '💎', '🏆', '📈', '🤝',
  '👍', '👎', '🤷', '🫡', '🫠', '😤', '😭', '🥺', '😈', '💀',
]

interface CastEditorProps {
  cast: CastItem
  index: number
  isThread: boolean
  maxChars: number
  onUpdate: (cast: CastItem) => void
  onRemove: () => void
}

export function CastEditor({
  cast,
  index,
  isThread,
  maxChars,
  onUpdate,
  onRemove,
}: CastEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [mentionState, setMentionState] = useState<{
    active: boolean
    query: string
    startPos: number
    position: { top: number; left: number }
  }>({ active: false, query: '', startPos: 0, position: { top: 0, left: 0 } })
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const gifPickerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const charCount = calculateTextLength(cast.content)
  const isOverLimit = charCount > maxChars

  // Detectar URLs en el contenido con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const urls = extractUrls(cast.content)
      
      // Filtrar URLs que ya son media (imágenes/videos directos)
      const linkUrls = urls.filter(url => !isMediaUrl(url))
      
      // URLs actuales en links
      const currentLinkUrls = cast.links.map(l => l.url)
      
      // Nuevas URLs a procesar
      const newUrls = linkUrls.filter(url => !currentLinkUrls.includes(url))
      
      // URLs a mantener (siguen en el texto)
      const linksToKeep = cast.links.filter(l => linkUrls.includes(l.url))
      
      // Si hay cambios, actualizar
      if (newUrls.length > 0 || linksToKeep.length !== cast.links.length) {
        // Añadir nuevas URLs con estado loading
        const newLinks: LinkEmbed[] = newUrls.map(url => ({
          url,
          loading: true,
        }))
        
        onUpdate({ ...cast, links: [...linksToKeep, ...newLinks] })
        
        // Fetch metadata para nuevas URLs
        newUrls.forEach(fetchLinkMetadata)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [cast.content])

  // Ref para acceder al cast actual en callbacks asíncronos
  const castRef = useRef(cast)
  useEffect(() => {
    castRef.current = cast
  }, [cast])

  // Fetch metadata de una URL
  const fetchLinkMetadata = useCallback(async (url: string) => {
    try {
      const res = await fetch('/api/og-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const metadata = await res.json()
      const currentCast = castRef.current

      // Actualizar el link con metadata
      onUpdate({
        ...currentCast,
        links: currentCast.links.map((l: LinkEmbed) =>
          l.url === url
            ? { ...l, ...metadata, loading: false }
            : l
        ),
      })
    } catch (error) {
      console.error('[Link Preview] Error fetching metadata:', error)
      const currentCast = castRef.current
      
      // Marcar como error
      onUpdate({
        ...currentCast,
        links: currentCast.links.map((l: LinkEmbed) =>
          l.url === url
            ? { ...l, loading: false, error: true }
            : l
        ),
      })
    }
  }, [onUpdate])

  // Eliminar un link
  const removeLink = (url: string) => {
    onUpdate({ ...cast, links: cast.links.filter(l => l.url !== url) })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    const cursorPos = e.target.selectionStart
    
    onUpdate({ ...cast, content: newContent })
    
    // Detectar si estamos escribiendo una mención
    const textBeforeCursor = newContent.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (mentionMatch) {
      const query = mentionMatch[1]
      const startPos = cursorPos - query.length - 1 // -1 para incluir @
      
      // Calcular posición del popup
      if (cardRef.current && textareaRef.current) {
        const cardRect = cardRef.current.getBoundingClientRect()
        // Posicionar debajo del textarea
        setMentionState({
          active: true,
          query,
          startPos,
          position: { top: 160, left: 16 }, // Posición relativa al card
        })
      }
    } else {
      if (mentionState.active) {
        setMentionState(prev => ({ ...prev, active: false }))
      }
    }
  }

  // Manejar selección de usuario para mention
  const handleMentionSelect = (user: { fid: number; username: string; displayName: string | null; pfpUrl: string | null }) => {
    const beforeMention = cast.content.slice(0, mentionState.startPos)
    const afterMention = cast.content.slice(mentionState.startPos + mentionState.query.length + 1) // +1 para @
    const newContent = `${beforeMention}@${user.username} ${afterMention}`
    
    onUpdate({ ...cast, content: newContent })
    setMentionState({ active: false, query: '', startPos: 0, position: { top: 0, left: 0 } })
    
    // Restaurar foco
    setTimeout(() => {
      const newCursorPos = beforeMention.length + user.username.length + 2 // @ + espacio
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const insertEmoji = (emoji: string) => {
    if (!textareaRef.current) return
    
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const currentContent = cast.content
    const newContent = currentContent.substring(0, start) + emoji + currentContent.substring(end)
    
    onUpdate({ ...cast, content: newContent })
    setShowEmojiPicker(false)
    
    // Restaurar foco y cursor
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Limpiar media con errores antes de añadir nuevos
    const cleanMedia = cast.media.filter(m => !m.error)
    
    if (cleanMedia.length + files.length > 2) {
      toast.error('Máximo 2 archivos por cast')
      return
    }

    const newMediaItems: MediaFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      uploading: true
    }))

    // Revocar URLs de media con errores que se van a eliminar
    cast.media.filter(m => m.error).forEach(m => URL.revokeObjectURL(m.preview))

    // Optimistic update - usar cleanMedia en lugar de cast.media
    let currentMedia = [...cleanMedia, ...newMediaItems]
    onUpdate({ ...cast, media: currentMedia })

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Upload files
    for (const mediaItem of newMediaItems) {
      if (!mediaItem.file) continue // Skip if no file object (should not happen here)

      try {
        const formData = new FormData()
        formData.append('file', mediaItem.file)

        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Error al subir')

        // Update success
        currentMedia = currentMedia.map(m => 
          m.preview === mediaItem.preview 
            ? { ...m, url: data.url, uploading: false } 
            : m
        )
        onUpdate({ ...cast, media: currentMedia })

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al subir'
        console.error('[Media Upload]', errorMessage)
        toast.error(errorMessage)
        // Update error - guardar mensaje específico para mostrar al usuario
        currentMedia = currentMedia.map(m => 
          m.preview === mediaItem.preview 
            ? { ...m, uploading: false, error: errorMessage } 
            : m
        )
        onUpdate({ ...cast, media: currentMedia })
      }
    }
  }

  const removeMedia = (preview: string) => {
    onUpdate({
      ...cast,
      media: cast.media.filter(m => m.preview !== preview)
    })
    URL.revokeObjectURL(preview)
  }

  const handleGifSelect = (gifUrl: string) => {
    if (cast.media.length >= 2) {
      toast.error('Máximo 2 archivos por cast')
      return
    }

    const newMedia: MediaFile = {
      preview: gifUrl,
      url: gifUrl,
      type: 'image',
      uploading: false,
    }

    onUpdate({ ...cast, media: [...cast.media, newMedia] })
    setShowGifPicker(false)
  }

  return (
    <Card ref={cardRef} className="p-4 relative group transition-all hover:shadow-sm">
      {/* Mention Autocomplete */}
      {mentionState.active && (
        <MentionAutocomplete
          query={mentionState.query}
          position={mentionState.position}
          onSelect={handleMentionSelect}
          onClose={() => setMentionState(prev => ({ ...prev, active: false }))}
        />
      )}

      {/* Header del Thread */}
      {isThread && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Cast {index + 1}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            title="Eliminar cast"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={cast.content}
        onChange={handleChange}
        placeholder={index === 0 ? '¿Qué quieres compartir?' : 'Continúa el thread...'}
        rows={4}
        className="border-0 focus-visible:ring-0 p-0 resize-none shadow-none text-lg leading-relaxed placeholder:text-gray-400 min-h-[120px]"
      />

      {/* Link Previews */}
      {cast.links.length > 0 && (
        <div className="space-y-2 mt-3 pt-3 border-t">
          {cast.links.map((link) => (
            <LinkPreview
              key={link.url}
              link={link}
              onRemove={() => removeLink(link.url)}
            />
          ))}
        </div>
      )}

      {/* Media Previews */}
      {cast.media.length > 0 && (
        <div className={cn(
          "flex gap-2 mt-3 pt-3",
          cast.links.length === 0 && "border-t"
        )}>
          {cast.media.map((m) => (
            <div key={m.preview} className="relative group/media">
              {m.type === 'image' ? (
                <img src={m.preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border" />
              ) : (
                <video src={m.preview} className="w-20 h-20 object-cover rounded-lg border" />
              )}
              
              {m.uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              
              {m.error && (
                <div className="absolute inset-0 bg-red-500/80 rounded-lg flex items-center justify-center p-1">
                  <span className="text-white text-[10px] text-center leading-tight font-medium">
                    Error
                  </span>
                </div>
              )}

              {!m.uploading && !m.error && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeMedia(m.preview)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity shadow-sm p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between pt-3 mt-2">
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={cast.media.length >= 2}
            className={cn(
              "text-gray-500 hover:text-castor-black",
              cast.media.length >= 2 && "opacity-50"
            )}
            title="Añadir imagen o video"
          >
            <Image className="w-5 h-5" />
          </Button>

          {/* Emoji Picker */}
          <div className="relative" ref={emojiPickerRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker)
                setShowGifPicker(false)
              }}
              className={cn(
                "text-gray-500 hover:text-castor-black",
                showEmojiPicker && "bg-gray-100 text-castor-black"
              )}
              title="Insertar emoji"
            >
              <Smile className="w-5 h-5" />
            </Button>

            {showEmojiPicker && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowEmojiPicker(false)}
                />
                <div className="absolute z-20 bottom-full mb-2 left-0 bg-white border rounded-xl shadow-xl p-2 w-72">
                  <div className="grid grid-cols-8 gap-1 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-xl transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* GIF Picker */}
          <div className="relative" ref={gifPickerRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowGifPicker(!showGifPicker)
                setShowEmojiPicker(false)
              }}
              disabled={cast.media.length >= 2}
              className={cn(
                "text-gray-500 hover:text-castor-black",
                showGifPicker && "bg-gray-100 text-castor-black",
                cast.media.length >= 2 && "opacity-50"
              )}
              title="Insertar GIF"
            >
              <span className="text-xs font-bold">GIF</span>
            </Button>

            {showGifPicker && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowGifPicker(false)}
                />
                <div className="absolute z-20 bottom-full mb-2 left-0 bg-white border rounded-xl shadow-xl overflow-hidden">
                  <GifPicker 
                    onSelect={handleGifSelect}
                    onClose={() => setShowGifPicker(false)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={cn(
            "text-xs font-medium transition-colors",
            isOverLimit ? "text-red-500" : "text-gray-400"
          )}>
            {charCount} / {maxChars}
          </span>
          {isOverLimit && (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
      </div>
    </Card>
  )
}
