/**
 * Utilidades para detección y procesamiento de URLs
 */

// Regex para detectar URLs http/https
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

const URL_WITHOUT_PROTOCOL_REGEX = /(?:^|[\s(])((?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"{}|\\^`[\]]+)+)/gi

/**
 * Extrae URLs únicas del texto
 */
export function extractUrls(text: string): string[] {
  const matchesWithProtocol = text.match(URL_REGEX) ?? []
  const matchesWithoutProtocol = Array.from(text.matchAll(URL_WITHOUT_PROTOCOL_REGEX)).map((m) => m[1]).filter(Boolean)
  const matches = [...matchesWithProtocol, ...matchesWithoutProtocol]
  if (matches.length === 0) return []

  // Eliminar duplicados y limpiar puntuación final
  return [...new Set(
    matches.map(url => url.replace(/[.,;:!?)]+$/, ''))
  )]
}

export function normalizeHttpUrl(input: string): string {
  const url = input.trim()
  if (!url) return url

  if (/^https?:\/\//i.test(url)) return url
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`

  if (/^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]|$)/i.test(url)) {
    return `https://${url}`
  }

  return url
}

/**
 * Metadatos Open Graph de un enlace
 */
export interface OgMetadata {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}

/**
 * Verifica si una URL apunta a imagen por extensión
 */
export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url)
}

/**
 * Verifica si una URL apunta a video por extensión
 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m3u8)(\?.*)?$/i.test(url)
}

/**
 * Verifica si una URL es apta para renderizar como imagen en preview
 */
export function isRenderableImageUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  if (url.includes('imagedelivery.net') || url.includes('cloudflare')) return true
  return isImageUrl(url)
}

/**
 * Verifica si una URL es de media (imagen/video)
 */
export function isMediaUrl(url: string): boolean {
  return isImageUrl(url) || isVideoUrl(url)
}

/**
 * Obtiene el dominio de una URL
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Verifica si una URL es de un cast de Warpcast
 */
export function isWarpcastUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?warpcast\.com\/[^/]+\/0x[a-fA-F0-9]+/.test(url)
}

/**
 * Extrae el hash de un cast de una URL de Warpcast
 */
export function extractCastHash(url: string): string | null {
  const match = url.match(/warpcast\.com\/[^/]+\/(0x[a-fA-F0-9]+)/)
  return match ? match[1] : null
}

/**
 * Longitud que cuenta una URL en Farcaster (similar a Twitter)
 */
export const URL_CHAR_LENGTH = 23

/**
 * Calcula la longitud "real" del texto para el límite de caracteres
 * Las URLs cuentan como URL_CHAR_LENGTH caracteres
 */
export function calculateTextLength(text: string): number {
  const urls = extractUrls(text)
  
  if (urls.length === 0) {
    return text.length
  }

  // Reemplazar cada URL por un placeholder de longitud fija
  let adjustedText = text
  for (const url of urls) {
    adjustedText = adjustedText.replace(url, 'X'.repeat(URL_CHAR_LENGTH))
  }

  return adjustedText.length
}
