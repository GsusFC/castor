'use client'

import { useState, useEffect, useRef } from 'react'
import { Image, Smile, Save, Send, LayoutTemplate, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CastItem, MediaFile } from './types'
import { GifPicker } from './GifPicker'
import { TemplateDropdown } from './TemplateDropdown'

const EMOJI_LIST = [
  '😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😅', '🙌', '👏',
  '🔥', '💯', '✨', '🚀', '💪', '🎉', '❤️', '💜', '💙', '💚',
  '👀', '🙏', '💡', '⚡', '🌟', '🎯', '💎', '🏆', '📈', '🤝',
  '👍', '👎', '🤷', '🫡', '🫠', '😤', '😭', '🥺', '😈', '💀',
]

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface ComposeFooterProps {
  isEditMode: boolean
  isThread: boolean
  hasContent: boolean
  hasOverLimit: boolean
  selectedAccountId: string | null
  scheduledDate: string
  scheduledTime: string
  isSubmitting: boolean
  isSavingDraft: boolean
  isSavingTemplate: boolean
  onSubmit: () => void
  onSaveDraft: () => void
  onSaveTemplate?: () => void
  casts: CastItem[]
  onUpdateCast: (index: number, cast: CastItem) => void
  templates?: Template[]
  onLoadTemplate?: (template: Template) => void
  onAddCast: () => void
}

export function ComposeFooter({
  isEditMode,
  isThread,
  hasContent,
  hasOverLimit,
  selectedAccountId,
  scheduledDate,
  scheduledTime,
  isSubmitting,
  isSavingDraft,
  isSavingTemplate,
  onSubmit,
  onSaveDraft,
  onSaveTemplate,
  casts,
  onUpdateCast,
  templates = [],
  onLoadTemplate,
  onAddCast,
}: ComposeFooterProps) {
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const castsRef = useRef(casts)

  useEffect(() => {
    castsRef.current = casts
  }, [casts])

  const currentCast = casts[0]
  const canAddMedia = currentCast && currentCast.media.length < 2

  useEffect(() => {
    textareaRef.current = document.querySelector('textarea')
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !currentCast) return

    const cleanMedia = currentCast.media.filter(m => !m.error)
    if (cleanMedia.length + files.length > 2) return

    const newMediaItems: MediaFile[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      uploading: true,
    }))

    let currentMedia = [...cleanMedia, ...newMediaItems]
    onUpdateCast(0, { ...currentCast, media: currentMedia })

    if (fileInputRef.current) fileInputRef.current.value = ''

    for (const mediaItem of newMediaItems) {
      if (!mediaItem.file) continue
      try {
        const file = mediaItem.file
        const isVideo = file.type.startsWith('video/')

        if (isVideo) {
          // Video upload to Cloudflare Stream
          const urlRes = await fetch('/api/media/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
            }),
          })
          const urlJson = await urlRes.json()
          if (!urlRes.ok) throw new Error(urlJson.error || 'Failed to get upload URL')

          const { uploadUrl, cloudflareId } = urlJson.data

          const uploadRes = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
              'Tus-Resumable': '1.0.0',
              'Upload-Offset': '0',
              'Content-Type': 'application/offset+octet-stream',
            },
            body: file,
          })
          if (!uploadRes.ok) throw new Error('Video upload failed')

          const confirmRes = await fetch('/api/media/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cloudflareId, type: 'video' }),
          })
          const confirmJson = await confirmRes.json()
          if (!confirmRes.ok) throw new Error(confirmJson.error || 'Failed to confirm upload')

          const data = confirmJson.data

          currentMedia = currentMedia.map(m =>
            m.preview === mediaItem.preview
              ? {
                  ...m,
                  url: data.url,
                  uploading: false,
                  cloudflareId: data.cloudflareId || cloudflareId,
                  videoStatus: 'pending' as const,
                }
              : m
          )
        } else {
          // Image upload to Cloudflare Images
          const urlRes = await fetch('/api/media/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
            }),
          })
          const urlJson = await urlRes.json()
          console.log('[Upload] Response:', urlRes.status, urlJson)
          if (!urlRes.ok) throw new Error(urlJson.error || `Failed to get upload URL (${urlRes.status})`)

          const { uploadUrl, id, cloudflareId } = urlJson.data

          const formData = new FormData()
          formData.append('file', file)
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
          })
          if (!uploadRes.ok) throw new Error('Image upload failed')

          const confirmRes = await fetch('/api/media/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cloudflareId: cloudflareId || id, type: 'image' }),
          })
          const confirmJson = await confirmRes.json()
          if (!confirmRes.ok) throw new Error(confirmJson.error || 'Failed to confirm upload')

          const data = confirmJson.data

          currentMedia = currentMedia.map(m =>
            m.preview === mediaItem.preview
              ? { ...m, url: data.url, uploading: false, cloudflareId: data.cloudflareId }
              : m
          )
        }

        const latestCast = castsRef.current[0]
        onUpdateCast(0, { ...latestCast, media: currentMedia })
      } catch (err) {
        console.error('[Upload] Error:', err)
        currentMedia = currentMedia.map(m =>
          m.preview === mediaItem.preview ? { ...m, uploading: false, error: 'Error' } : m
        )
        const latestCast = castsRef.current[0]
        onUpdateCast(0, { ...latestCast, media: currentMedia })
      }
    }
  }

  const handleGifSelect = (gifUrl: string) => {
    if (!currentCast || currentCast.media.length >= 2) return
    const newMedia: MediaFile = {
      preview: gifUrl,
      url: gifUrl,
      type: 'image',
      uploading: false,
    }
    onUpdateCast(0, { ...currentCast, media: [...currentCast.media, newMedia] })
    setShowGifPicker(false)
  }

  const insertEmoji = (emoji: string) => {
    if (!textareaRef.current || !currentCast) return
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const newContent = currentCast.content.substring(0, start) + emoji + currentCast.content.substring(end)
    onUpdateCast(0, { ...currentCast, content: newContent })
    setShowEmojiPicker(false)
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  const canSubmit =
    selectedAccountId &&
    hasContent &&
    !hasOverLimit &&
    scheduledDate &&
    scheduledTime &&
    !isSubmitting &&
    !isSavingDraft

  return (
    <div className="flex items-center px-3 pt-2 pb-4 sm:p-3 border-t border-border bg-muted/50 gap-1 sm:gap-2">
      {/* File input hidden */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Subir imagen o video"
      />

      {/* Media button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={!canAddMedia}
        className="h-10 sm:h-8 px-3 sm:px-2 touch-target text-muted-foreground"
        aria-label="Add image or video"
      >
        <Image className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" />
        <span className="hidden sm:inline text-xs">Image</span>
      </Button>

      {/* GIF Picker */}
      <Popover open={showGifPicker} onOpenChange={setShowGifPicker}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canAddMedia}
            className="h-10 sm:h-8 px-3 sm:px-2 touch-target text-muted-foreground font-bold"
            aria-label="Add GIF"
          >
            GIF
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        </PopoverContent>
      </Popover>

      {/* Emoji Picker */}
      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 sm:h-8 px-3 sm:px-2 touch-target text-muted-foreground"
            aria-label="Add emoji"
          >
            <Smile className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center hover:bg-accent rounded text-lg transition-colors"
                aria-label={`Insertar ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Draft button - solo en modo crear */}
      {!isEditMode && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSaveDraft}
          disabled={isSavingDraft || isSubmitting || !selectedAccountId}
          className="h-10 sm:h-8 px-3 sm:px-2 touch-target text-muted-foreground"
          aria-label="Save as draft"
        >
          <Save className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs">
            {isSavingDraft ? 'Saving...' : 'Draft'}
          </span>
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Add to thread button - solo en modo crear */}
      {!isEditMode && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddCast}
          disabled={!hasContent}
          className="h-10 sm:h-8 px-3 sm:px-2 touch-target text-muted-foreground"
          aria-label="Add to thread"
        >
          <Plus className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs">Thread</span>
        </Button>
      )}

      {/* Template dropdown */}
      {!isEditMode && templates.length > 0 && onLoadTemplate && (
        <TemplateDropdown templates={templates} onSelect={onLoadTemplate} />
      )}

      {/* Save Template button */}
      {!isEditMode && onSaveTemplate && hasContent && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSaveTemplate}
          disabled={isSavingTemplate || isSubmitting || !selectedAccountId}
          className="h-10 sm:h-8 px-3 sm:px-2 touch-target text-muted-foreground"
          aria-label="Save as template"
        >
          <LayoutTemplate className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs">
            {isSavingTemplate ? 'Saving...' : 'Save'}
          </span>
        </Button>
      )}

      {/* Submit button */}
      <Button
        type="button"
        size="sm"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="h-10 sm:h-8 px-4 sm:px-3 touch-target"
        aria-label={isEditMode ? 'Save changes' : 'Schedule cast'}
      >
        <Send className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" />
        {isSubmitting
          ? isEditMode
            ? 'Saving...'
            : 'Scheduling...'
          : isEditMode
            ? 'Save'
            : isThread
              ? 'Schedule Thread'
              : 'Schedule'}
      </Button>
    </div>
  )
}
