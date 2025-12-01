export interface MediaFile {
  file?: File
  preview: string
  type: 'image' | 'video'
  url?: string
  uploading?: boolean
  error?: string
}

export interface CastItem {
  id: string
  content: string
  media: MediaFile[]
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
