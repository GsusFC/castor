/**
 * Utilities for responsive image loading
 * Generates optimized image URLs for different viewport sizes
 */

/**
 * Standard responsive image widths
 * Based on common device widths and Tailwind breakpoints
 */
export const RESPONSIVE_WIDTHS = {
  mobile: 320,
  mobileLarge: 480,
  tablet: 640,
  desktop: 1024,
  desktopLarge: 1280,
} as const

/**
 * Generates optimized image URL for Cloudflare Images
 * @param url - Original image URL
 * @param width - Desired width in pixels
 * @returns Optimized image URL
 */
function getCloudflareImageUrl(url: string, width: number): string {
  // Cloudflare Images format: https://imagedelivery.net/{account_hash}/{image_id}/{variant}
  // We can use public variant with width parameter
  if (url.includes('imagedelivery.net')) {
    const parts = url.split('/')
    const accountHash = parts[3]
    const imageId = parts[4]
    return `https://imagedelivery.net/${accountHash}/${imageId}/w=${width},format=auto`
  }
  return url
}

/**
 * Generates optimized image URL for Imgur
 * @param url - Original image URL
 * @param width - Desired width in pixels
 * @returns Optimized image URL
 */
function getImgurImageUrl(url: string, width: number): string {
  // Imgur supports size suffixes: s=small, m=medium, l=large, h=huge
  // For more control, we can use their CDN parameters
  if (url.includes('i.imgur.com') || url.includes('imgur.com')) {
    // Just return original - Imgur doesn't have great responsive support
    return url
  }
  return url
}

/**
 * Generates optimized image URL for any image service
 * Detects the service and applies appropriate optimizations
 *
 * @param url - Original image URL
 * @param width - Desired width in pixels
 * @returns Optimized image URL
 *
 * @example
 * ```ts
 * getOptimizedImageUrl('https://imagedelivery.net/...', 640)
 * // Returns: 'https://imagedelivery.net/.../w=640,format=auto'
 * ```
 */
export function getOptimizedImageUrl(url: string, width: number): string {
  if (!url) return url

  // Cloudflare Images
  if (url.includes('imagedelivery.net')) {
    return getCloudflareImageUrl(url, width)
  }

  // Imgur
  if (url.includes('imgur.com')) {
    return getImgurImageUrl(url, width)
  }

  // Twitter/X images
  if (url.includes('pbs.twimg.com')) {
    // Twitter supports ?format=jpg&name=small|medium|large
    return `${url}?format=jpg&name=medium`
  }

  // GIPHY
  if (url.includes('giphy.com') || url.includes('media.giphy.com')) {
    // GIPHY URLs already optimized
    return url
  }

  // For other services, return original
  // Could add support for more services here (imgix, etc.)
  return url
}

/**
 * Generates srcset string for responsive images
 * Creates multiple image variants for different screen sizes
 *
 * @param url - Original image URL
 * @param widths - Array of widths to generate (defaults to standard responsive widths)
 * @returns srcset string for img tag
 *
 * @example
 * ```tsx
 * <img
 *   src={url}
 *   srcset={generateSrcSet(url)}
 *   sizes="(max-width: 640px) 100vw, 640px"
 * />
 * ```
 */
export function generateSrcSet(
  url: string,
  widths: number[] = Object.values(RESPONSIVE_WIDTHS)
): string {
  return widths
    .map((width) => `${getOptimizedImageUrl(url, width)} ${width}w`)
    .join(', ')
}

/**
 * Standard sizes attribute for full-width mobile images
 * Responsive: 100vw on mobile, 50vw on tablet, 640px on desktop
 */
export const SIZES_FULL_WIDTH = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px'

/**
 * Sizes attribute for carousel images
 * Smaller on mobile (80vw), medium on tablet, fixed on desktop
 */
export const SIZES_CAROUSEL = '(max-width: 640px) 80vw, (max-width: 1024px) 400px, 512px'

/**
 * Sizes attribute for thumbnail/avatar images
 * Fixed small size across all breakpoints
 */
export const SIZES_THUMBNAIL = '64px'

/**
 * Sizes attribute for compact preview images
 * Very small, fixed size
 */
export const SIZES_COMPACT = '256px'
