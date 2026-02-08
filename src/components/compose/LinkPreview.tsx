'use client'

/**
 * LinkPreview para Composer
 * Wrapper que usa el sistema unificado de embeds
 */

import { EmbedPreview } from '@/components/embeds'
import { LinkEmbed } from './types'

interface LinkPreviewProps {
  link: LinkEmbed
  onRemove: () => void
  onRetry?: () => void
  compact?: boolean
}

export function LinkPreview({ link, onRemove, onRetry, compact }: LinkPreviewProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <EmbedPreview
        url={link.url}
        metadata={{
          title: link.title,
          description: link.description,
          image: link.image,
          favicon: link.favicon,
          siteName: link.siteName,
          frameImage: link.frameImage,
          frameButtons: link.frameButtons,
          isFrame: link.isFrame,
        }}
        onRemove={onRemove}
        loading={link.loading}
        error={link.error}
        isFrame={link.isFrame}
        compact={compact}
      />
      {compact && link.loading && (
        <span className="text-[10px] text-muted-foreground px-1">Fetching preview...</span>
      )}
      {compact && link.error && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-destructive">Preview failed</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
