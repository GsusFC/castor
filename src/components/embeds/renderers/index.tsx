import dynamic from 'next/dynamic'

export { ImageRenderer } from './ImageRenderer'
export { VideoRenderer } from './VideoRenderer'
export const TweetRenderer = dynamic(() => import('./TweetRenderer').then(m => m.TweetRenderer), {
    loading: () => <div className="w-full h-48 bg-muted animate-pulse rounded-lg" />,
})
export const YouTubeRenderer = dynamic(() => import('./YouTubeRenderer').then(m => m.YouTubeRenderer), {
    loading: () => <div className="w-full aspect-video bg-muted animate-pulse rounded-lg" />,
})
export { extractYouTubeId } from './YouTubeRenderer'
export { CastRenderer, isFarcasterCastUrl } from './CastRenderer'
export { LinkRenderer } from './LinkRenderer'
