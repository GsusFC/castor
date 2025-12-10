// Tipos base para el sistema unificado de embeds

export type EmbedType = 
  | 'image'
  | 'video'
  | 'tweet'
  | 'youtube'
  | 'cast'       // Farcaster cast embebido
  | 'frame'      // Mini App / Frame
  | 'link'       // Link genérico con OG

export interface EmbedAuthor {
  fid?: number
  username: string
  display_name: string
  pfp_url?: string
}

export interface EmbedCast {
  hash: string
  text: string
  author: EmbedAuthor
  // embeds puede tener diferentes formatos según la fuente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embeds?: any[]
}

export interface EmbedMetadata {
  title?: string
  description?: string
  image?: string
  favicon?: string
  siteName?: string
  // Frame specific
  frameImage?: string
  frameButtons?: string[]
  isFrame?: boolean
}

export interface EmbedData {
  type: EmbedType
  url: string
  // Para casts embebidos
  cast?: EmbedCast
  // Para metadata de links
  metadata?: EmbedMetadata
  // Para YouTube
  videoId?: string
  // Para tweets
  tweetId?: string
  // Estado
  loading?: boolean
  error?: boolean
}

// Props compartidas para renderers
export interface BaseRendererProps {
  className?: string
}

export interface RemovableProps {
  onRemove?: () => void
  showRemove?: boolean
}
