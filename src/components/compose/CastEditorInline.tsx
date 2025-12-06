'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CastItem, MediaFile, LinkEmbed } from './types'
import { LinkPreview } from './LinkPreview'
import { MentionAutocomplete } from './MentionAutocomplete'
import { VideoValidation } from './VideoValidation'
import { extractUrls, isMediaUrl, calculateTextLength } from '@/lib/url-utils'

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const removeMedia = (preview: string) => {
    onUpdate({ ...cast, media: cast.media.filter(m => m.preview !== preview) })
    URL.revokeObjectURL(preview)
  }

  const removeLink = (url: string) => {
    onUpdate({ ...cast, links: cast.links.filter(l => l.url !== url) })
  }

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
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              aria-label={`Eliminar cast ${index + 1}`}
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
        placeholder={index === 0 ? 'What do you want to share?' : 'Continue the thread...'}
        rows={6}
        className={cn(
          "border-0 p-0 resize-none shadow-none text-base leading-relaxed bg-transparent placeholder:text-muted-foreground min-h-[120px] md:min-h-[150px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
          isOverLimit && "text-destructive"
        )}
        aria-label={isThread ? `Contenido del cast ${index + 1}` : 'Contenido del cast'}
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
        <div className="flex gap-2 mt-3 flex-wrap">
          {cast.media.map((m) => (
            <MediaPreviewItem
              key={m.preview}
              media={m}
              onRemove={() => removeMedia(m.preview)}
            />
          ))}
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
  return (
    <div className="relative group/media">
      {media.type === 'image' ? (
        <img
          src={media.preview}
          alt="Preview"
          className="w-16 h-16 object-cover rounded-lg border"
        />
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
