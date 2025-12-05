export const MAX_CHARS_FREE = 320
export const MAX_CHARS_PREMIUM = 1024

export const getMaxChars = (isPremium: boolean): number =>
  isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
