import { useRef, useState } from 'react'
import { Image, Smile, X, Trash2, Loader2 } from 'lucide-react'
import { CastItem, MediaFile } from './types'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const charCount = cast.content.length
  const isOverLimit = charCount > maxChars

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...cast, content: e.target.value })
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

    if (cast.media.length + files.length > 2) {
      toast.error('Máximo 2 archivos por cast')
      return
    }

    const newMediaItems: MediaFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      uploading: true
    }))

    // Optimistic update
    let currentMedia = [...cast.media, ...newMediaItems]
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
        console.error(err)
        toast.error('Error al subir archivo')
        // Update error
        currentMedia = currentMedia.map(m => 
          m.preview === mediaItem.preview 
            ? { ...m, uploading: false, error: 'Error al subir' } 
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

  return (
    <Card className="p-4 relative group transition-all hover:shadow-sm">
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

      {/* Media Previews */}
      {cast.media.length > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t">
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
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
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
