import dynamic from 'next/dynamic'

export { ImageRenderer } from './ImageRenderer'
export { VideoRenderer } from './VideoRenderer'
export const TweetRenderer = dynamic(
    () => import('./TweetRenderer').then(m => m.TweetRenderer)
)
export const YouTubeRenderer = dynamic(
    () => import('./YouTubeRenderer').then(m => m.YouTubeRenderer)
)
export { extractYouTubeId } from './YouTubeRenderer'
export { CastRenderer, isFarcasterCastUrl } from './CastRenderer'
export { LinkRenderer } from './LinkRenderer'
