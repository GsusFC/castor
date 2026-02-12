/**
 * Shared types used across v2 server components and client components.
 * Single source of truth — no more duplicate interfaces.
 */

// ─── Serialized types (what the server sends to the client) ──────────────────

export interface SerializedAccount {
  id: string
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
  signerStatus: string
  type: string
  voiceMode: 'auto' | 'brand' | 'personal'
  isPremium: boolean
  ownerId: string | null
  owner: {
    id: string
    username: string
    displayName: string | null
    pfpUrl: string | null
  } | null
  hasBrandVoice: boolean
}

export interface SerializedCast {
  id: string
  content: string
  status: string
  network?: 'farcaster' | 'x' | 'linkedin'
  publishTargets?: Array<'farcaster' | 'x' | 'linkedin'>
  scheduledAt: string
  publishedAt: string | null
  castHash: string | null
  channelId: string | null
  errorMessage: string | null
  retryCount: number
  accountId: string
  account: SerializedCastAccount | null
  createdBy: SerializedCastAccount | null
  media: SerializedCastMedia[]
}

export interface SerializedCastAccount {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

export interface SerializedCastMedia {
  id: string
  url: string
  type: 'image' | 'video'
  thumbnailUrl: string | null
  cloudflareId?: string | null
  livepeerAssetId?: string | null
  livepeerPlaybackId?: string | null
  videoStatus?: string | null
  mp4Url?: string | null
  hlsUrl?: string | null
}

export interface SerializedTemplate {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

// ─── User session (from auth) ────────────────────────────────────────────────

export interface SessionUser {
  userId: string
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
  role: string
}
