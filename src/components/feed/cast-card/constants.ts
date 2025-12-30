// Storage keys for moderation
export const MUTED_FIDS_STORAGE_KEY = 'castor:mutedFids'
export const BLOCKED_FIDS_STORAGE_KEY = 'castor:blockedFids'
export const MODERATION_UPDATED_EVENT = 'castor:moderation-updated'

// Next.js Image optimization allowed hostnames
export const NEXT_IMAGE_ALLOWED_HOSTNAMES = new Set<string>([
  'imagedelivery.net',
  'videodelivery.net',
  'watch.cloudflarestream.com',
  'avatar.vercel.sh',
  'i.imgur.com',
  'imgur.com',
  'pbs.twimg.com',
  'media.giphy.com',
  'i.giphy.com',
  'giphy.com',
  'cdn.discordapp.com',
  'firesidebase.vercel.app',
  'upgrader.co',
])

// Text truncation
export const MAX_TEXT_LENGTH = 280
