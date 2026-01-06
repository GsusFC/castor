import { describe, it, expect } from 'vitest'
import {
  CHAR_LIMITS,
  EMBED_LIMITS,
  MEDIA_RULES,
  getMaxChars,
  getMaxEmbeds,
  getMaxFileSize,
  isAllowedMimeType,
  isImageMimeType,
  isVideoMimeType,
  getMediaTypeFromMime,
  formatFileSize,
} from './validation-rules'

describe('validation-rules', () => {
  describe('constants', () => {
    it('should have correct character limits', () => {
      expect(CHAR_LIMITS.standard).toBe(1024)
      expect(CHAR_LIMITS.pro).toBe(10000)
      expect(CHAR_LIMITS.min).toBe(1)
    })

    it('should have correct embed limits', () => {
      expect(EMBED_LIMITS.standard).toBe(2)
      expect(EMBED_LIMITS.pro).toBe(4)
    })

    it('should have correct media size limits', () => {
      expect(MEDIA_RULES.maxImageSize).toBe(10 * 1024 * 1024) // 10MB
      expect(MEDIA_RULES.maxVideoSize).toBe(100 * 1024 * 1024) // 100MB
    })
  })

  describe('getMaxChars', () => {
    it('should return standard limit for non-pro', () => {
      expect(getMaxChars(false)).toBe(1024)
    })

    it('should return pro limit for pro users', () => {
      expect(getMaxChars(true)).toBe(10000)
    })
  })

  describe('getMaxEmbeds', () => {
    it('should return standard limit for non-pro', () => {
      expect(getMaxEmbeds(false)).toBe(2)
    })

    it('should return pro limit for pro users', () => {
      expect(getMaxEmbeds(true)).toBe(4)
    })
  })

  describe('getMaxFileSize', () => {
    it('should return image size for images', () => {
      expect(getMaxFileSize('image')).toBe(10 * 1024 * 1024)
    })

    it('should return video size for videos', () => {
      expect(getMaxFileSize('video')).toBe(100 * 1024 * 1024)
    })
  })

  describe('isAllowedMimeType', () => {
    it('should allow valid image types', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true)
      expect(isAllowedMimeType('image/png')).toBe(true)
      expect(isAllowedMimeType('image/gif')).toBe(true)
      expect(isAllowedMimeType('image/webp')).toBe(true)
    })

    it('should allow valid video types', () => {
      expect(isAllowedMimeType('video/mp4')).toBe(true)
      expect(isAllowedMimeType('video/quicktime')).toBe(true)
      expect(isAllowedMimeType('video/webm')).toBe(true)
    })

    it('should reject invalid types', () => {
      expect(isAllowedMimeType('application/pdf')).toBe(false)
      expect(isAllowedMimeType('text/plain')).toBe(false)
      expect(isAllowedMimeType('image/svg+xml')).toBe(false)
    })
  })

  describe('isImageMimeType', () => {
    it('should identify image types', () => {
      expect(isImageMimeType('image/jpeg')).toBe(true)
      expect(isImageMimeType('image/png')).toBe(true)
      expect(isImageMimeType('video/mp4')).toBe(false)
    })
  })

  describe('isVideoMimeType', () => {
    it('should identify video types', () => {
      expect(isVideoMimeType('video/mp4')).toBe(true)
      expect(isVideoMimeType('video/webm')).toBe(true)
      expect(isVideoMimeType('image/jpeg')).toBe(false)
    })
  })

  describe('getMediaTypeFromMime', () => {
    it('should return image for image types', () => {
      expect(getMediaTypeFromMime('image/jpeg')).toBe('image')
      expect(getMediaTypeFromMime('image/png')).toBe('image')
    })

    it('should return video for video types', () => {
      expect(getMediaTypeFromMime('video/mp4')).toBe('video')
    })

    it('should return null for unknown types', () => {
      expect(getMediaTypeFromMime('application/pdf')).toBe(null)
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB')
    })
  })
})
