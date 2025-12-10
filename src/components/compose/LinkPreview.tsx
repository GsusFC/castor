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
  compact?: boolean
}

export function LinkPreview({ link, onRemove, compact }: LinkPreviewProps) {
  return (
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
  )
}
