'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, Image, Send, User, Loader2, X, Hash, Smile, Plus, Trash2, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const MAX_CHARS_FREE = 320
const MAX_CHARS_PREMIUM = 1024

const EMOJI_LIST = [
  '😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😅', '🙌', '👏',
  '🔥', '💯', '✨', '🚀', '💪', '🎉', '❤️', '💜', '💙', '💚',
  '👀', '🙏', '💡', '⚡', '🌟', '🎯', '💎', '🏆', '📈', '🤝',
  '👍', '👎', '🤷', '🫡', '🫠', '😤', '😭', '🥺', '😈', '💀',
]

interface Account {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
  isPremium?: boolean
}

interface MediaFile {
  file: File
  preview: string
  type: 'image' | 'video'
  url?: string
  uploading?: boolean
  error?: string
}

interface Channel {
  id: string
  name: string
  imageUrl?: string
}

interface CastItem {
  id: string
  content: string
  media: MediaFile[]
}

export default function ComposePage() {
  const router = useRouter()
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Canal
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelSearch, setChannelSearch] = useState('')
  const [showChannelPicker, setShowChannelPicker] = useState(false)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  
  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [activeCastIndex, setActiveCastIndex] = useState(0)
  
  // Thread (cadena de casts)
  const [casts, setCasts] = useState<CastItem[]>([
    { id: crypto.randomUUID(), content: '', media: [] }
  ])
  
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const channelPickerRef = useRef<HTMLDivElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Obtener cuenta seleccionada y su límite de caracteres
  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const maxChars = selectedAccountData?.isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
  
  // Verificar si algún cast excede el límite
  const hasOverLimit = casts.some(cast => cast.content.length > maxChars)
  const hasContent = casts.some(cast => cast.content.trim().length > 0)
  const isThread = casts.length > 1

  // Cerrar pickers al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (channelPickerRef.current && !channelPickerRef.current.contains(event.target as Node)) {
        setShowChannelPicker(false)
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cargar cuentas
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts')
        const data = await res.json()
        const approvedAccounts = data.accounts?.filter((a: Account & { signerStatus: string }) => a.signerStatus === 'approved') || []
        setAccounts(approvedAccounts)
        if (approvedAccounts.length > 0) {
          setSelectedAccount(approvedAccounts[0].id)
        }
      } catch (err) {
        console.error('Error loading accounts:', err)
      } finally {
        setIsLoadingAccounts(false)
      }
    }
    loadAccounts()
  }, [])

  // Cargar canales
  const loadChannels = useCallback(async (query?: string) => {
    setIsLoadingChannels(true)
    try {
      const url = query ? `/api/channels?q=${encodeURIComponent(query)}` : '/api/channels'
      const res = await fetch(url)
      const data = await res.json()
      setChannels(data.channels || [])
    } catch (err) {
      console.error('Error loading channels:', err)
    } finally {
      setIsLoadingChannels(false)
    }
  }, [])

  // Cargar canales cuando se abre el picker
  useEffect(() => {
    if (showChannelPicker && channels.length === 0) {
      loadChannels()
    }
  }, [showChannelPicker, channels.length, loadChannels])

  // Buscar canales con debounce
  useEffect(() => {
    if (!showChannelPicker) return
    const timer = setTimeout(() => {
      loadChannels(channelSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [channelSearch, showChannelPicker, loadChannels])

  // Actualizar contenido de un cast
  const updateCastContent = (index: number, content: string) => {
    setCasts(prev => prev.map((cast, i) => 
      i === index ? { ...cast, content } : cast
    ))
  }

  // Añadir cast al thread
  const addCast = () => {
    setCasts(prev => [...prev, { id: crypto.randomUUID(), content: '', media: [] }])
    setTimeout(() => {
      const newIndex = casts.length
      textareaRefs.current[newIndex]?.focus()
    }, 100)
  }

  // Eliminar cast del thread
  const removeCast = (index: number) => {
    if (casts.length <= 1) return
    setCasts(prev => prev.filter((_, i) => i !== index))
  }

  // Insertar emoji
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRefs.current[activeCastIndex]
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentContent = casts[activeCastIndex].content
    const newContent = currentContent.substring(0, start) + emoji + currentContent.substring(end)
    
    updateCastContent(activeCastIndex, newContent)
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  // Manejar selección de archivo para un cast específico
  const handleFileSelect = async (castIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const cast = casts[castIndex]
    if (cast.media.length + files.length > 2) {
      setError('Máximo 2 archivos por cast')
      return
    }

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')

      if (!isVideo && !isImage) {
        setError('Tipo de archivo no soportado')
        continue
      }

      const preview = URL.createObjectURL(file)
      const newMedia: MediaFile = {
        file,
        preview,
        type: isVideo ? 'video' : 'image',
        uploading: true,
      }

      setCasts(prev => prev.map((c, i) => 
        i === castIndex ? { ...c, media: [...c.media, newMedia] } : c
      ))

      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Error al subir')
        }

        setCasts(prev => prev.map((c, i) => 
          i === castIndex ? {
            ...c,
            media: c.media.map(m => 
              m.preview === preview ? { ...m, url: data.url, uploading: false } : m
            )
          } : c
        ))
      } catch (err) {
        setCasts(prev => prev.map((c, i) => 
          i === castIndex ? {
            ...c,
            media: c.media.map(m => 
              m.preview === preview ? { ...m, uploading: false, error: err instanceof Error ? err.message : 'Error' } : m
            )
          } : c
        ))
      }
    }

    if (fileInputRefs.current[castIndex]) {
      fileInputRefs.current[castIndex]!.value = ''
    }
  }

  // Eliminar media de un cast
  const removeMedia = (castIndex: number, preview: string) => {
    setCasts(prev => prev.map((c, i) => 
      i === castIndex ? { ...c, media: c.media.filter(m => m.preview !== preview) } : c
    ))
    URL.revokeObjectURL(preview)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedAccount || !hasContent || !scheduledDate || !scheduledTime) {
      return
    }

    setIsSubmitting(true)

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      
      if (isThread) {
        // Crear thread
        const res = await fetch('/api/casts/schedule-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccount,
            channelId: selectedChannel?.id,
            scheduledAt,
            casts: casts.map(cast => ({
              content: cast.content,
              embeds: cast.media.filter(m => m.url && !m.error).map(m => ({ url: m.url! })),
            })),
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al programar thread')
      } else {
        // Crear cast individual
        const cast = casts[0]
        const embeds = cast.media.filter(m => m.url && !m.error).map(m => ({ url: m.url! }))

        const res = await fetch('/api/casts/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccount,
            content: cast.content,
            channelId: selectedChannel?.id,
            scheduledAt,
            embeds: embeds.length > 0 ? embeds : undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al programar')
      }

      router.push('/dashboard/scheduled')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isThread ? 'Nuevo Thread' : 'Nuevo Cast'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isThread ? `${casts.length} casts en cadena` : 'Programa un nuevo cast'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account selector */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Cuenta</label>
          {isLoadingAccounts ? (
            <div className="text-center py-6">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay cuentas conectadas</p>
              <Link href="/dashboard/accounts/connect" className="text-sm text-castor-black hover:underline mt-1 inline-block">
                Añadir cuenta
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccount(account.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedAccount === account.id ? 'border-castor-black bg-castor-black/5' : 'hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium block">{account.displayName || account.username}</span>
                  <span className="text-sm text-gray-500">@{account.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Channel selector */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Canal (opcional)</label>
          <div className="relative" ref={channelPickerRef}>
            <button
              type="button"
              onClick={() => setShowChannelPicker(!showChannelPicker)}
              className="w-full flex items-center justify-between p-3 border rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                {selectedChannel ? (
                  <span className="font-medium">{selectedChannel.name}</span>
                ) : (
                  <span className="text-gray-400">Seleccionar canal</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showChannelPicker ? 'rotate-180' : ''}`} />
            </button>

            {showChannelPicker && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-hidden">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="Buscar canal..."
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-castor-black focus:border-castor-black"
                  />
                </div>
                <div className="overflow-y-auto max-h-48">
                  {selectedChannel && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChannel(null)
                        setShowChannelPicker(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Sin canal
                    </button>
                  )}
                  {isLoadingChannels ? (
                    <div className="p-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : channels.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No se encontraron canales
                    </div>
                  ) : (
                    channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => {
                          setSelectedChannel(channel)
                          setShowChannelPicker(false)
                          setChannelSearch('')
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                      >
                        {channel.imageUrl ? (
                          <img src={channel.imageUrl} alt="" className="w-6 h-6 rounded" />
                        ) : (
                          <Hash className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium">{channel.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Casts (Thread) */}
        <div className="space-y-4">
          {casts.map((cast, index) => {
            const charCount = cast.content.length
            const isOverLimit = charCount > maxChars

            return (
              <div key={cast.id} className="bg-white rounded-xl border p-4 relative">
                {/* Thread indicator */}
                {isThread && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Cast {index + 1}
                    </span>
                    {casts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCast(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <textarea
                  ref={el => { textareaRefs.current[index] = el }}
                  value={cast.content}
                  onChange={(e) => updateCastContent(index, e.target.value)}
                  onFocus={() => setActiveCastIndex(index)}
                  placeholder={index === 0 ? '¿Qué quieres compartir?' : 'Continúa el thread...'}
                  rows={4}
                  className="w-full resize-none border-0 focus:ring-0 p-0 placeholder:text-gray-400"
                />

                {/* Media preview */}
                {cast.media.length > 0 && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    {cast.media.map((m) => (
                      <div key={m.preview} className="relative group">
                        {m.type === 'image' ? (
                          <img src={m.preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                        ) : (
                          <video src={m.preview} className="w-20 h-20 object-cover rounded-lg" />
                        )}
                        
                        {m.uploading && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                        {m.error && (
                          <div className="absolute inset-0 bg-red-500/50 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs px-1 text-center">{m.error}</span>
                          </div>
                        )}
                        {m.url && !m.uploading && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => removeMedia(index, m.preview)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 hover:bg-gray-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t mt-3">
                  <div className="flex items-center gap-1">
                    <input
                      ref={el => { fileInputRefs.current[index] = el }}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                      multiple
                      onChange={(e) => handleFileSelect(index, e)}
                      className="hidden"
                      id={`media-upload-${index}`}
                    />
                    <label
                      htmlFor={`media-upload-${index}`}
                      className={`p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer ${
                        cast.media.length >= 2 ? 'opacity-50 pointer-events-none' : 'text-gray-500'
                      }`}
                    >
                      <Image className="w-5 h-5" />
                    </label>

                    {/* Emoji picker */}
                    <div className="relative" ref={index === activeCastIndex ? emojiPickerRef : undefined}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCastIndex(index)
                          setShowEmojiPicker(!showEmojiPicker || activeCastIndex !== index)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                      >
                        <Smile className="w-5 h-5" />
                      </button>

                      {showEmojiPicker && activeCastIndex === index && (
                        <div className="absolute z-10 bottom-full mb-2 left-0 bg-white border rounded-lg shadow-lg p-2 w-64">
                          <div className="grid grid-cols-10 gap-1">
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  insertEmoji(emoji)
                                  setShowEmojiPicker(false)
                                }}
                                className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAccountData?.isPremium && (
                      <span className="text-xs bg-castor-light text-castor-black px-2 py-0.5 rounded-full font-medium">
                        Pro
                      </span>
                    )}
                    <span className={`text-sm ${isOverLimit ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {charCount}/{maxChars}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add cast button */}
          <button
            type="button"
            onClick={addCast}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Añadir cast al thread
          </button>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Programar para</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-castor-black focus:border-castor-black"
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-castor-black focus:border-castor-black"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard" className="px-4 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !selectedAccount || !hasContent || hasOverLimit || !scheduledDate || !scheduledTime}
            className="flex items-center gap-2 bg-castor-black hover:bg-castor-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Programando...' : isThread ? 'Programar Thread' : 'Programar'}
          </button>
        </div>
      </form>
    </div>
  )
}
