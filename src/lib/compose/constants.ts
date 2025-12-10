// Límites de caracteres según Farcaster
export const MAX_CHARS_STANDARD = 1024
export const MAX_CHARS_PRO = 10000

// Límites de embeds/imágenes por cast
export const MAX_EMBEDS_STANDARD = 2
export const MAX_EMBEDS_PRO = 4

export const getMaxChars = (isPro: boolean): number =>
  isPro ? MAX_CHARS_PRO : MAX_CHARS_STANDARD

export const getMaxEmbeds = (isPro: boolean): number =>
  isPro ? MAX_EMBEDS_PRO : MAX_EMBEDS_STANDARD
