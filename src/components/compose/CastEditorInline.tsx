'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CastItem, MediaFile, LinkEmbed } from './types'
import { LinkPreview } from './LinkPreview'
import { MentionAutocomplete } from './MentionAutocomplete'
import { VideoValidation } from './VideoValidation'
import { extractUrls, isMediaUrl, isRenderableImageUrl, calculateTextLength, normalizeHttpUrl } from '@/lib/url-utils'
import { renderCastText } from '@/lib/cast-text'

interface CastEditorInlineProps {
  cast: CastItem
  index: number
  isThread: boolean
  maxChars: number
  onUpdate: (cast: CastItem) => void
  onRemove: () => void
}

export function CastEditorInline({
  cast,
  index,
  isThread,
  maxChars,
  onUpdate,
  onRemove,
}: CastEditorInlineProps) {
  const [mentionState, setMentionState] = useState<{
    active: boolean
    query: string
    startPos: number
    position: { top: number; left: number }
  }>({ active: false, query: '', startPos: 0, position: { top: 0, left: 0 } })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const castRef = useRef(cast)

  useEffect(() => {
    castRef.current = cast
  }, [cast])

  const charCount = calculateTextLength(cast.content)
  const isOverLimit = charCount > maxChars

  /**
   * Syntax highlighting para @handles, URLs, $tickers, /channels
   */
  const highlightText = (text: string) => {
    return renderCastText(text, { variant: 'highlight' })
  }

  // URL detection with debounce
  // Solo detecta URLs nuevas en el texto, no elimina links añadidos manualmente (quote)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const urls = extractUrls(cast.content).map(normalizeHttpUrl)
      const linkUrls = urls.filter(url => !isMediaUrl(url))
      const currentLinkUrls = cast.links.map(l => normalizeHttpUrl(l.url))
      const newUrls = linkUrls.filter(url => !currentLinkUrls.includes(url))
      
      // Solo eliminar links que fueron detectados del texto y ya no están
      // Mantener links que no están en el texto (añadidos manualmente, ej: quote)
      const linksFromText = cast.links.filter(l => l.fromText)
      const linksManual = cast.links.filter(l => !l.fromText)
      const linksToKeep = linksFromText
        .filter(l => linkUrls.includes(normalizeHttpUrl(l.url)))
        .map((l) => {
          const normalizedUrl = normalizeHttpUrl(l.url)
          if (normalizedUrl === l.url) return l
          return { ...l, url: normalizedUrl }
        })

      if (newUrls.length > 0 || linksToKeep.length !== linksFromText.length) {
        const newLinks: LinkEmbed[] = newUrls.map(url => ({ url, loading: true, fromText: true }))
        onUpdate({ ...cast, links: [...linksManual, ...linksToKeep, ...newLinks] })
        newUrls.forEach(fetchLinkMetadata)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cast.content])

  const fetchLinkMetadata = async (url: string) => {
    try {
      const normalizedUrl = normalizeHttpUrl(url)
      const res = await fetch('/api/og-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      })
      const metadata = await res.json()
      const currentCast = castRef.current
      onUpdate({
        ...currentCast,
        links: currentCast.links.map((l: LinkEmbed) =>
          l.url === normalizedUrl ? { ...l, ...metadata, loading: false } : l
        ),
      })
    } catch {
      const currentCast = castRef.current
      const normalizedUrl = normalizeHttpUrl(url)
      onUpdate({
        ...currentCast,
        links: currentCast.links.map((l: LinkEmbed) =>
          l.url === normalizedUrl ? { ...l, loading: false, error: true } : l
        ),
      })
    }
  }

  // Auto-resize textarea
  const autoResize = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    autoResize()
  }, [cast.content])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    const cursorPos = e.target.selectionStart

    onUpdate({ ...cast, content: newContent })
    autoResize()

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

  const removeMedia = (preview: string) => {
    onUpdate({ ...cast, media: cast.media.filter(m => m.preview !== preview) })
    URL.revokeObjectURL(preview)
  }

  const removeLink = (url: string) => {
    onUpdate({ ...cast, links: cast.links.filter(l => l.url !== url) })
  }

  const retryLinkMetadata = (url: string) => {
    const normalizedUrl = normalizeHttpUrl(url)
    const currentCast = castRef.current
    onUpdate({
      ...currentCast,
      links: currentCast.links.map((l: LinkEmbed) =>
        l.url === normalizedUrl ? { ...l, loading: true, error: false } : l
      ),
    })
    fetchLinkMetadata(normalizedUrl)
  }

  const attachments = [
    ...cast.media.map((media) => ({ kind: 'media' as const, key: `m:${media.preview}`, media })),
    ...cast.links.map((link) => ({ kind: 'link' as const, key: `l:${link.url}`, link })),
  ]

  return (
    <div ref={containerRef} className="relative p-4 flex flex-col flex-1">
      {/* Thread indicator */}
      {isThread && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Cast {index + 1}
          </span>
          {index > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
              aria-label={`Eliminar cast ${index + 1}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-destructive/10">
                <X className="w-4 h-4" />
              </span>
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

      {/* Textarea con syntax highlighting */}
      <div className="relative flex-1">
        {/* Overlay para syntax highlighting */}
        <div 
          className="absolute inset-0 pointer-events-none text-base leading-relaxed whitespace-pre-wrap break-words p-0 overflow-hidden"
          aria-hidden="true"
        >
          {highlightText(cast.content)}
        </div>
        
        {/* Textarea real (texto transparente) */}
        <Textarea
          ref={textareaRef}
          value={cast.content}
          onChange={handleChange}
          placeholder={index === 0 ? 'What do you want to share?' : 'Continue the thread...'}
          rows={3}
          className={cn(
            "border-0 p-0 resize-none shadow-none text-base leading-relaxed bg-transparent placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none overflow-hidden",
            isOverLimit ? "text-destructive" : "text-transparent"
          )}
          style={{ caretColor: 'hsl(var(--primary))' }}
          aria-label={isThread ? `Contenido del cast ${index + 1}` : 'Contenido del cast'}
        />
      </div>

      {/* Previews compactas - scroll horizontal en móvil */}
      {attachments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Attachments</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              Media {cast.media.length}/2
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {attachments.map((attachment) =>
            attachment.kind === 'media' ? (
              <MediaPreviewItem
                key={attachment.key}
                media={attachment.media}
                onRemove={() => removeMedia(attachment.media.preview)}
              />
            ) : (
              <LinkPreview
                key={attachment.key}
                link={attachment.link}
                onRemove={() => removeLink(attachment.link.url)}
                onRetry={() => retryLinkMetadata(attachment.link.url)}
                compact
              />
            )
          )}
          </div>
        </div>
      )}

      {/* Thread char count */}
      {isThread && (
        <div className="flex items-center justify-end mt-2 pt-2 border-t border-border">
          <span className={cn(
            "text-xs tabular-nums",
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          )}>
            {charCount}/{maxChars}
          </span>
        </div>
      )}
    </div>
  )
}

// Subcomponente para preview de media
function MediaPreviewItem({
  media,
  onRemove,
}: {
  media: MediaFile
  onRemove: () => void
}) {
  const [imageErrored, setImageErrored] = useState(false)
  const canRenderImage = media.type === 'image' && isRenderableImageUrl(media.preview) && !imageErrored

  return (
    <div className="relative group/media">
      {canRenderImage ? (
        <img
          src={media.preview}
          alt="Preview"
          className="w-16 h-16 object-cover rounded-lg border"
          onError={() => setImageErrored(true)}
        />
      ) : media.type === 'image' ? (
        <div className="w-16 h-16 rounded-lg border bg-muted/40 flex flex-col items-center justify-center text-muted-foreground gap-0.5">
          <ImageOff className="w-4 h-4" />
          <span className="text-[9px] font-medium">Image</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <video
            src={media.preview}
            className="w-16 h-16 object-cover rounded-lg border"
          />
          {!media.uploading && media.url && (
            <VideoValidation
              url={media.url}
              videoStatus={media.videoStatus}
              cloudflareId={media.cloudflareId}
            />
          )}
        </div>
      )}

      {/* Loading overlay */}
      {media.uploading && (
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        </div>
      )}

      {/* Error indicator */}
      {media.error && (
        <div className="absolute inset-0 bg-red-500/20 rounded-lg flex items-center justify-center">
          <span className="text-xs text-destructive font-medium">Error</span>
        </div>
      )}

      {/* Remove button */}
      {!media.uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center focus-visible:opacity-100"
          aria-label="Eliminar media"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
