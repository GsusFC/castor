export interface MediaFile {
  file?: File
  preview: string
  type: 'image' | 'video'
  url?: string
  uploading?: boolean
  error?: string
  cloudflareId?: string
  videoStatus?: 'pending' | 'processing' | 'ready' | 'error'
}

export interface LinkEmbed {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
  loading?: boolean
  error?: boolean
}

export interface CastItem {
  id: string
  content: string
  media: MediaFile[]
  links: LinkEmbed[]
}

export interface Account {
  id: string
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
  isPremium?: boolean
  signerStatus?: string
}

export interface Channel {
  id: string
  name: string
  imageUrl?: string
}

export interface ReplyToCast {
  hash: string
  text: string
  author: {
    fid: number
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
  timestamp: string
}
