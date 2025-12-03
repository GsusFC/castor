/**
 * Utilidades para detección y procesamiento de URLs
 */

// Regex para detectar URLs http/https
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

/**
 * Extrae URLs únicas del texto
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []

  // Eliminar duplicados y limpiar puntuación final
  return [...new Set(
    matches.map(url => url.replace(/[.,;:!?)]+$/, ''))
  )]
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
 * Verifica si una URL es de media (imagen/video)
 */
export function isMediaUrl(url: string): boolean {
  const mediaExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|svg)(\?.*)?$/i
  return mediaExtensions.test(url)
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
