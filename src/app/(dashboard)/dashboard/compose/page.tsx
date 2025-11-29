'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, Image, Video, Send, User, Loader2, X } from 'lucide-react'
import Link from 'next/link'

const MAX_CHARS_FREE = 320
const MAX_CHARS_PREMIUM = 1024

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

export default function ComposePage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [media, setMedia] = useState<MediaFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Obtener cuenta seleccionada y su límite de caracteres
  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const maxChars = selectedAccountData?.isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
  const charCount = content.length
  const isOverLimit = charCount > maxChars

  // Cargar cuentas
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts')
        const data = await res.json()
        console.log('Accounts loaded:', data)
        const approvedAccounts = data.accounts?.filter((a: Account & { signerStatus: string }) => a.signerStatus === 'approved') || []
        console.log('Approved accounts:', approvedAccounts)
        setAccounts(approvedAccounts)
        
        // Seleccionar primera cuenta por defecto
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

  // Manejar selección de archivo
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Máximo 2 archivos por cast
    if (media.length + files.length > 2) {
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

      // Crear preview
      const preview = URL.createObjectURL(file)
      const newMedia: MediaFile = {
        file,
        preview,
        type: isVideo ? 'video' : 'image',
        uploading: true,
      }

      setMedia(prev => [...prev, newMedia])

      // Subir archivo
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

        // Actualizar con URL
        setMedia(prev =>
          prev.map(m =>
            m.preview === preview
              ? { ...m, url: data.url, uploading: false }
              : m
          )
        )
      } catch (err) {
        setMedia(prev =>
          prev.map(m =>
            m.preview === preview
              ? { ...m, uploading: false, error: err instanceof Error ? err.message : 'Error' }
              : m
          )
        )
      }
    }

    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Eliminar media
  const removeMedia = (preview: string) => {
    setMedia(prev => prev.filter(m => m.preview !== preview))
    URL.revokeObjectURL(preview)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedAccount || !content || !scheduledDate || !scheduledTime) {
      return
    }

    setIsSubmitting(true)

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      
      // Obtener URLs de media subidos
      const embeds = media
        .filter(m => m.url && !m.error)
        .map(m => ({ url: m.url! }))

      const res = await fetch('/api/casts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount,
          content,
          scheduledAt,
          embeds: embeds.length > 0 ? embeds : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al programar')
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
        <Link
          href="/dashboard"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Cast</h1>
          <p className="text-gray-500 mt-1">Programa un nuevo cast</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account selector */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Cuenta
          </label>
          {isLoadingAccounts ? (
            <div className="text-center py-6">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay cuentas conectadas</p>
              <Link
                href="/dashboard/accounts/connect"
                className="text-sm text-castor-black hover:underline mt-1 inline-block"
              >
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
                    selectedAccount === account.id
                      ? 'border-castor-black bg-castor-black/5'
                      : 'hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium block">
                    {account.displayName || account.username}
                  </span>
                  <span className="text-sm text-gray-500">@{account.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Contenido
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="¿Qué quieres compartir?"
            rows={5}
            className="w-full resize-none border-0 focus:ring-0 p-0 placeholder:text-gray-400"
          />

          {/* Media preview */}
          {media.length > 0 && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              {media.map((m) => (
                <div key={m.preview} className="relative group">
                  {m.type === 'image' ? (
                    <img
                      src={m.preview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      src={m.preview}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                  
                  {/* Overlay de estado */}
                  {m.uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
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

                  {/* Botón eliminar */}
                  <button
                    type="button"
                    onClick={() => removeMedia(m.preview)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 hover:bg-gray-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Badge de tipo */}
                  {m.type === 'video' && (
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      <Video className="w-3 h-3 inline mr-0.5" />
                      Video
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer ${
                  media.length >= 2 ? 'opacity-50 pointer-events-none' : 'text-gray-500'
                }`}
                title={media.length >= 2 ? 'Máximo 2 archivos' : 'Añadir imagen o video'}
              >
                <Image className="w-5 h-5" />
              </label>
              {media.length > 0 && (
                <span className="text-xs text-gray-400">{media.length}/2</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedAccountData?.isPremium && (
                <span className="text-xs bg-castor-light text-castor-black px-2 py-0.5 rounded-full font-medium">
                  Pro
                </span>
              )}
              <span
                className={`text-sm ${
                  isOverLimit ? 'text-red-500 font-medium' : 'text-gray-500'
                }`}
              >
                {charCount}/{maxChars}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Programar para
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
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
            </div>
            <div>
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
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !selectedAccount ||
              !content ||
              isOverLimit ||
              !scheduledDate ||
              !scheduledTime
            }
            className="flex items-center gap-2 bg-castor-black hover:bg-castor-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Programando...' : 'Programar'}
          </button>
        </div>
      </form>
    </div>
  )
}
