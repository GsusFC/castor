'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  ChevronDown, 
  Hash, 
  Clock, 
  Eye, 
  Plus, 
  Image, 
  Smile, 
  Save, 
  Send,
  X,
  Loader2,
  Search,
  Calendar
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CastItem, Account, Channel, ReplyToCast } from './types'
import { CastPreview } from './CastPreview'
import { GifPicker } from './GifPicker'
import { LinkPreview } from './LinkPreview'
import { MentionAutocomplete } from './MentionAutocomplete'
import { extractUrls, isMediaUrl, calculateTextLength } from '@/lib/url-utils'
import { MediaFile, LinkEmbed } from './types'

const EMOJI_LIST = [
  '😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😅', '🙌', '👏',
  '🔥', '💯', '✨', '🚀', '💪', '🎉', '❤️', '💜', '💙', '💚',
  '👀', '🙏', '💡', '⚡', '🌟', '🎯', '💎', '🏆', '📈', '🤝',
  '👍', '👎', '🤷', '🫡', '🫠', '😤', '😭', '🥺', '😈', '💀',
]

interface ComposeCardProps {
  accounts: Account[]
  selectedAccountId: string | null
  onSelectAccount: (id: string) => void
  isLoadingAccounts: boolean
  selectedChannel: Channel | null
  onSelectChannel: (channel: Channel | null) => void
  casts: CastItem[]
  onUpdateCast: (index: number, cast: CastItem) => void
  onAddCast: () => void
  onRemoveCast: (index: number) => void
  scheduledDate: string
  scheduledTime: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  replyTo: ReplyToCast | null
  onSelectReplyTo: (cast: ReplyToCast | null) => void
  maxChars: number
  isSubmitting: boolean
  isSavingDraft: boolean
  onSubmit: () => void
  onSaveDraft: () => void
  hasContent: boolean
  hasOverLimit: boolean
  isEditMode?: boolean
}

export function ComposeCard({
  accounts,
  selectedAccountId,
  onSelectAccount,
  isLoadingAccounts,
  selectedChannel,
  onSelectChannel,
  casts,
  onUpdateCast,
  onAddCast,
  onRemoveCast,
  scheduledDate,
  scheduledTime,
  onDateChange,
  onTimeChange,
  replyTo,
  onSelectReplyTo,
  maxChars,
  isSubmitting,
  isSavingDraft,
  onSubmit,
  onSaveDraft,
  hasContent,
  hasOverLimit,
  isEditMode = false,
}: ComposeCardProps) {
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)
  const isThread = casts.length > 1
  const today = new Date().toISOString().split('T')[0]

  // Formatear fecha/hora para mostrar
  const getScheduleLabel = () => {
    if (!scheduledDate || !scheduledTime) return null
    const date = new Date(`${scheduledDate}T${scheduledTime}`)
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const scheduleLabel = getScheduleLabel()

  // Calcular caracteres totales
  const totalChars = casts.reduce((acc, cast) => acc + calculateTextLength(cast.content), 0)
  const currentCastChars = casts[0] ? calculateTextLength(casts[0].content) : 0

  return (
    <Card className="overflow-hidden">
      {/* Header compacto */}
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50/50 flex-wrap">
        {/* Account Selector */}
        <AccountDropdown
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelect={onSelectAccount}
          isLoading={isLoadingAccounts}
        />

        {/* Channel Selector */}
        <ChannelDropdown
          selectedChannel={selectedChannel}
          onSelect={onSelectChannel}
          accountFid={selectedAccount?.fid}
        />

        {/* Schedule Selector */}
        <ScheduleDropdown
          date={scheduledDate}
          time={scheduledTime}
          onDateChange={onDateChange}
          onTimeChange={onTimeChange}
          label={scheduleLabel}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Preview button - solo desktop */}
        <PreviewPopover
          casts={casts}
          account={selectedAccount || null}
          channel={selectedChannel}
          replyTo={replyTo}
          hasContent={hasContent}
        />

        {/* Add to thread button - solo en modo crear */}
        {!isEditMode && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAddCast}
            disabled={!hasContent}
            className={cn(
              "h-8 w-8",
              !hasContent && "opacity-40"
            )}
            title="Añadir al thread"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}

        {/* Character count */}
        <span className={cn(
          "text-xs font-medium tabular-nums px-2",
          hasOverLimit ? "text-red-500" : "text-gray-400"
        )}>
          {currentCastChars}/{maxChars}
        </span>
      </div>

      {/* Reply To */}
      {replyTo && (
        <div className="flex items-start gap-3 p-3 bg-gray-50 border-b">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {replyTo.author.pfpUrl && (
                <img src={replyTo.author.pfpUrl} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-gray-500">
                Respondiendo a @{replyTo.author.username}
              </span>
            </div>
            <p className="text-xs text-gray-400 line-clamp-1">{replyTo.text}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onSelectReplyTo(null)}
            className="h-6 w-6 shrink-0 text-gray-400 hover:text-red-500"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Cast Editors */}
      <div className="divide-y">
        {casts.map((cast, index) => (
          <CastEditorInline
            key={cast.id}
            cast={cast}
            index={index}
            isThread={isThread}
            maxChars={maxChars}
            onUpdate={(updatedCast) => onUpdateCast(index, updatedCast)}
            onRemove={() => onRemoveCast(index)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end p-3 border-t bg-gray-50/50 gap-2">
        {/* Borrador - solo en modo crear */}
        {!isEditMode && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSavingDraft || isSubmitting || !selectedAccountId}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSavingDraft ? 'Guardando...' : 'Borrador'}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitting || isSavingDraft || !selectedAccountId || !hasContent || hasOverLimit || !scheduledDate || !scheduledTime}
        >
          <Send className="w-4 h-4 mr-2" />
          {isSubmitting 
            ? (isEditMode ? 'Guardando...' : 'Programando...') 
            : isEditMode 
              ? 'Guardar' 
              : isThread 
                ? 'Programar Thread' 
                : 'Programar'
          }
        </Button>
      </div>
    </Card>
  )
}

// ============================================
// Sub-componentes
// ============================================

function AccountDropdown({
  accounts,
  selectedAccount,
  onSelect,
  isLoading,
}: {
  accounts: Account[]
  selectedAccount: Account | undefined
  onSelect: (id: string) => void
  isLoading: boolean
}) {
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8">
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    )
  }

  if (accounts.length === 0) {
    return (
      <Button variant="outline" size="sm" className="h-8 text-gray-500">
        Sin cuentas
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          {selectedAccount?.pfpUrl ? (
            <img src={selectedAccount.pfpUrl} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-200" />
          )}
          <span className="max-w-[100px] truncate">
            @{selectedAccount?.username || 'Cuenta'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => {
              onSelect(account.id)
              setOpen(false)
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-gray-100 transition-colors",
              selectedAccount?.id === account.id && "bg-gray-100"
            )}
          >
            {account.pfpUrl ? (
              <img src={account.pfpUrl} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200" />
            )}
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium truncate">{account.displayName || account.username}</p>
              <p className="text-xs text-gray-500">@{account.username}</p>
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function ChannelDropdown({
  selectedChannel,
  onSelect,
  accountFid,
}: {
  selectedChannel: Channel | null
  onSelect: (channel: Channel | null) => void
  accountFid?: number
}) {
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("h-8 gap-1", !selectedChannel && "text-gray-500")}
        >
          <Hash className="w-3 h-3" />
          <span className="max-w-[80px] truncate">
            {selectedChannel ? selectedChannel.name : 'Canal'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar canal..."
              className="pl-8 h-8"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {selectedChannel && (
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 rounded-md"
            >
              Quitar canal
            </button>
          )}
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : channels.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Sin resultados</p>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => {
                  onSelect(channel)
                  setOpen(false)
                  setSearch('')
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-gray-100",
                  selectedChannel?.id === channel.id && "bg-gray-100"
                )}
              >
                {channel.imageUrl ? (
                  <img src={channel.imageUrl} alt="" className="w-6 h-6 rounded" />
                ) : (
                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                    <Hash className="w-3 h-3 text-gray-400" />
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

function ScheduleDropdown({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
}: {
  date: string
  time: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  label: string | null
}) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("h-8 gap-1", !label && "text-gray-500")}
        >
          <Clock className="w-3 h-3" />
          <span className="max-w-[120px] truncate">
            {label || 'Programar'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                min={today}
                className="w-full h-9 pl-8 pr-3 rounded-md border text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Hora</label>
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="time"
                value={time}
                onChange={(e) => onTimeChange(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-md border text-sm"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PreviewPopover({
  casts,
  account,
  channel,
  replyTo,
  hasContent,
}: {
  casts: CastItem[]
  account: Account | null
  channel: Channel | null
  replyTo: ReplyToCast | null
  hasContent: boolean
}) {
  if (!hasContent) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden md:flex"
          title="Vista previa"
        >
          <Eye className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <CastPreview
          casts={casts}
          account={account}
          channel={channel}
          replyTo={replyTo}
          compact
        />
      </PopoverContent>
    </Popover>
  )
}

// Editor inline simplificado
function CastEditorInline({
  cast,
  index,
  isThread,
  maxChars,
  onUpdate,
  onRemove,
}: {
  cast: CastItem
  index: number
  isThread: boolean
  maxChars: number
  onUpdate: (cast: CastItem) => void
  onRemove: () => void
}) {
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
  const containerRef = useRef<HTMLDivElement>(null)
  const castRef = useRef(cast)

  useEffect(() => {
    castRef.current = cast
  }, [cast])

  const charCount = calculateTextLength(cast.content)
  const isOverLimit = charCount > maxChars

  // URL detection with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const urls = extractUrls(cast.content)
      const linkUrls = urls.filter(url => !isMediaUrl(url))
      const currentLinkUrls = cast.links.map(l => l.url)
      const newUrls = linkUrls.filter(url => !currentLinkUrls.includes(url))
      const linksToKeep = cast.links.filter(l => linkUrls.includes(l.url))

      if (newUrls.length > 0 || linksToKeep.length !== cast.links.length) {
        const newLinks: LinkEmbed[] = newUrls.map(url => ({ url, loading: true }))
        onUpdate({ ...cast, links: [...linksToKeep, ...newLinks] })
        newUrls.forEach(fetchLinkMetadata)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [cast.content])

  const fetchLinkMetadata = async (url: string) => {
    try {
      const res = await fetch('/api/og-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const metadata = await res.json()
      const currentCast = castRef.current
      onUpdate({
        ...currentCast,
        links: currentCast.links.map((l: LinkEmbed) =>
          l.url === url ? { ...l, ...metadata, loading: false } : l
        ),
      })
    } catch {
      const currentCast = castRef.current
      onUpdate({
        ...currentCast,
        links: currentCast.links.map((l: LinkEmbed) =>
          l.url === url ? { ...l, loading: false, error: true } : l
        ),
      })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    const cursorPos = e.target.selectionStart

    onUpdate({ ...cast, content: newContent })

    // Mention detection
    const textBeforeCursor = newContent.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1]
      const startPos = cursorPos - query.length - 1
      setMentionState({
        active: true,
        query,
        startPos,
        position: { top: 160, left: 16 },
      })
    } else if (mentionState.active) {
      setMentionState(prev => ({ ...prev, active: false }))
    }
  }

  const handleMentionSelect = (user: { fid: number; username: string }) => {
    const beforeMention = cast.content.slice(0, mentionState.startPos)
    const afterMention = cast.content.slice(mentionState.startPos + mentionState.query.length + 1)
    const newContent = `${beforeMention}@${user.username} ${afterMention}`

    onUpdate({ ...cast, content: newContent })
    setMentionState({ active: false, query: '', startPos: 0, position: { top: 0, left: 0 } })

    setTimeout(() => {
      const newCursorPos = beforeMention.length + user.username.length + 2
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const insertEmoji = (emoji: string) => {
    if (!textareaRef.current) return
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const newContent = cast.content.substring(0, start) + emoji + cast.content.substring(end)
    onUpdate({ ...cast, content: newContent })
    setShowEmojiPicker(false)
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const cleanMedia = cast.media.filter(m => !m.error)
    if (cleanMedia.length + files.length > 2) {
      return
    }

    const newMediaItems: MediaFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      uploading: true,
    }))

    let currentMedia = [...cleanMedia, ...newMediaItems]
    onUpdate({ ...cast, media: currentMedia })

    if (fileInputRef.current) fileInputRef.current.value = ''

    for (const mediaItem of newMediaItems) {
      if (!mediaItem.file) continue
      try {
        const formData = new FormData()
        formData.append('file', mediaItem.file)
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        currentMedia = currentMedia.map(m =>
          m.preview === mediaItem.preview ? { ...m, url: data.url, uploading: false } : m
        )
        onUpdate({ ...cast, media: currentMedia })
      } catch (err) {
        currentMedia = currentMedia.map(m =>
          m.preview === mediaItem.preview ? { ...m, uploading: false, error: 'Error' } : m
        )
        onUpdate({ ...cast, media: currentMedia })
      }
    }
  }

  const handleGifSelect = (gifUrl: string) => {
    if (cast.media.length >= 2) return
    const newMedia: MediaFile = {
      preview: gifUrl,
      url: gifUrl,
      type: 'image',
      uploading: false,
    }
    onUpdate({ ...cast, media: [...cast.media, newMedia] })
    setShowGifPicker(false)
  }

  const removeMedia = (preview: string) => {
    onUpdate({ ...cast, media: cast.media.filter(m => m.preview !== preview) })
    URL.revokeObjectURL(preview)
  }

  const removeLink = (url: string) => {
    onUpdate({ ...cast, links: cast.links.filter(l => l.url !== url) })
  }

  return (
    <div ref={containerRef} className="relative p-4">
      {/* Thread indicator */}
      {isThread && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
            Cast {index + 1}
          </span>
          {index > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-6 w-6 text-gray-400 hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}

      {/* Mention Autocomplete */}
      {mentionState.active && (
        <MentionAutocomplete
          query={mentionState.query}
          position={mentionState.position}
          onSelect={handleMentionSelect}
          onClose={() => setMentionState(prev => ({ ...prev, active: false }))}
        />
      )}

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={cast.content}
        onChange={handleChange}
        placeholder={index === 0 ? '¿Qué quieres compartir?' : 'Continúa el thread...'}
        rows={3}
        className={cn(
          "border-0 focus-visible:ring-0 p-0 resize-none shadow-none text-base leading-relaxed placeholder:text-gray-400 min-h-[80px]",
          isOverLimit && "text-red-500"
        )}
      />

      {/* Link Previews */}
      {cast.links.length > 0 && (
        <div className="space-y-2 mt-3">
          {cast.links.map((link) => (
            <LinkPreview key={link.url} link={link} onRemove={() => removeLink(link.url)} />
          ))}
        </div>
      )}

      {/* Media Previews */}
      {cast.media.length > 0 && (
        <div className="flex gap-2 mt-3">
          {cast.media.map((m) => (
            <div key={m.preview} className="relative group/media">
              {m.type === 'image' ? (
                <img src={m.preview} alt="" className="w-16 h-16 object-cover rounded-lg border" />
              ) : (
                <video src={m.preview} className="w-16 h-16 object-cover rounded-lg border" />
              )}
              {m.uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
              {!m.uploading && (
                <button
                  type="button"
                  onClick={() => removeMedia(m.preview)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={cast.media.length >= 2}
          className="h-8 w-8 text-gray-500"
        >
          <Image className="w-4 h-4" />
        </Button>

        {/* Emoji Picker */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
              <Smile className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* GIF Picker */}
        <Popover open={showGifPicker} onOpenChange={setShowGifPicker}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={cast.media.length >= 2}
              className="h-8 px-2 text-gray-500 text-xs font-bold"
            >
              GIF
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
          </PopoverContent>
        </Popover>

        {/* Thread char count */}
        {isThread && (
          <span className={cn(
            "ml-auto text-xs tabular-nums",
            isOverLimit ? "text-red-500" : "text-gray-400"
          )}>
            {charCount}/{maxChars}
          </span>
        )}
      </div>
    </div>
  )
}
