import { describe, it, expect } from 'vitest'
import type { MediaFile } from '@/components/compose/types'
import {
  validateFile,
  validateFiles,
  getTypeFromExtension,
  getTypeFromUrl,
  isMediaUrl,
  isKnownMediaProvider,
  isMediaReady,
  isAllMediaReady,
  getUploadingMedia,
  getErrorMedia,
  getPendingVideos,
  getMediaStatus,
  createMediaFromUrl,
  updateMediaAfterUpload,
  updateMediaAfterError,
} from './media-utils'

describe('media-utils', () => {
  describe('validateFile', () => {
    it('should validate allowed image types', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const result = validateFile(file)
      
      expect(result.valid).toBe(true)
      expect(result.type).toBe('image')
    })

    it('should validate allowed video types', () => {
      const file = new File([''], 'test.mp4', { type: 'video/mp4' })
      const result = validateFile(file)
      
      expect(result.valid).toBe(true)
      expect(result.type).toBe('video')
    })

    it('should reject invalid mime types', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' })
      const result = validateFile(file)
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not supported')
    })

    it('should reject files that are too large', () => {
      // Create a mock large file
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('')
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const result = validateFile(file)
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too large')
    })
  })

  describe('validateFiles', () => {
    it('should separate valid and invalid files', () => {
      const validFile = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const invalidFile = new File([''], 'test.pdf', { type: 'application/pdf' })
      
      const result = validateFiles([validFile, invalidFile])
      
      expect(result.valid).toHaveLength(1)
      expect(result.invalid).toHaveLength(1)
    })
  })

  describe('getTypeFromExtension', () => {
    it('should detect image extensions', () => {
      expect(getTypeFromExtension('photo.jpg')).toBe('image')
      expect(getTypeFromExtension('photo.jpeg')).toBe('image')
      expect(getTypeFromExtension('photo.png')).toBe('image')
      expect(getTypeFromExtension('photo.gif')).toBe('image')
      expect(getTypeFromExtension('photo.webp')).toBe('image')
    })

    it('should detect video extensions', () => {
      expect(getTypeFromExtension('video.mp4')).toBe('video')
      expect(getTypeFromExtension('video.mov')).toBe('video')
      expect(getTypeFromExtension('video.webm')).toBe('video')
    })

    it('should return null for unknown extensions', () => {
      expect(getTypeFromExtension('file.pdf')).toBe(null)
      expect(getTypeFromExtension('noextension')).toBe(null)
    })
  })

  describe('getTypeFromUrl', () => {
    it('should detect type from URL path', () => {
      expect(getTypeFromUrl('https://example.com/image.jpg')).toBe('image')
      expect(getTypeFromUrl('https://example.com/video.mp4')).toBe('video')
    })

    it('should handle URLs with query params', () => {
      expect(getTypeFromUrl('https://example.com/image.jpg?w=100')).toBe('image')
    })
  })

  describe('isMediaUrl', () => {
    it('should identify media URLs', () => {
      expect(isMediaUrl('https://example.com/photo.jpg')).toBe(true)
      expect(isMediaUrl('https://example.com/video.mp4')).toBe(true)
    })

    it('should reject non-media URLs', () => {
      expect(isMediaUrl('https://example.com/page.html')).toBe(false)
    })
  })

  describe('isKnownMediaProvider', () => {
    it('should identify Cloudflare URLs', () => {
      expect(isKnownMediaProvider('https://imagedelivery.net/abc/123')).toBe(true)
      expect(isKnownMediaProvider('https://stream.cloudflare.com/abc')).toBe(true)
    })

    it('should identify Livepeer URLs', () => {
      expect(isKnownMediaProvider('https://lp-playback.com/abc')).toBe(true)
    })
  })

  describe('isMediaReady', () => {
    it('should return true for ready media', () => {
      const media: MediaFile = {
        preview: 'blob:...',
        url: 'https://example.com/image.jpg',
        type: 'image',
        uploading: false,
      }
      expect(isMediaReady(media)).toBe(true)
    })

    it('should return false for uploading media', () => {
      const media: MediaFile = {
        preview: 'blob:...',
        type: 'image',
        uploading: true,
      }
      expect(isMediaReady(media)).toBe(false)
    })

    it('should return false for media with errors', () => {
      const media: MediaFile = {
        preview: 'blob:...',
        url: 'https://example.com/image.jpg',
        type: 'image',
        uploading: false,
        error: 'Upload failed',
      }
      expect(isMediaReady(media)).toBe(false)
    })

    it('should return false for pending videos', () => {
      const media: MediaFile = {
        preview: 'blob:...',
        url: 'https://example.com/video.mp4',
        type: 'video',
        uploading: false,
        videoStatus: 'pending',
      }
      expect(isMediaReady(media)).toBe(false)
    })
  })

  describe('isAllMediaReady', () => {
    it('should return true if all media is ready', () => {
      const media: MediaFile[] = [
        { preview: '', url: 'https://a.jpg', type: 'image', uploading: false },
        { preview: '', url: 'https://b.jpg', type: 'image', uploading: false },
      ]
      expect(isAllMediaReady(media)).toBe(true)
    })

    it('should return false if any media is not ready', () => {
      const media: MediaFile[] = [
        { preview: '', url: 'https://a.jpg', type: 'image', uploading: false },
        { preview: '', type: 'image', uploading: true },
      ]
      expect(isAllMediaReady(media)).toBe(false)
    })
  })

  describe('getUploadingMedia', () => {
    it('should return only uploading media', () => {
      const media: MediaFile[] = [
        { preview: '', url: 'https://a.jpg', type: 'image', uploading: false },
        { preview: '', type: 'image', uploading: true },
      ]
      expect(getUploadingMedia(media)).toHaveLength(1)
    })
  })

  describe('getErrorMedia', () => {
    it('should return only media with errors', () => {
      const media: MediaFile[] = [
        { preview: '', url: 'https://a.jpg', type: 'image', uploading: false },
        { preview: '', type: 'image', uploading: false, error: 'Failed' },
      ]
      expect(getErrorMedia(media)).toHaveLength(1)
    })
  })

  describe('getPendingVideos', () => {
    it('should return pending and processing videos', () => {
      const media: MediaFile[] = [
        { preview: '', url: 'https://a.jpg', type: 'image', uploading: false },
        { preview: '', url: 'https://v.mp4', type: 'video', uploading: false, videoStatus: 'pending' },
        { preview: '', url: 'https://v2.mp4', type: 'video', uploading: false, videoStatus: 'processing' },
        { preview: '', url: 'https://v3.mp4', type: 'video', uploading: false, videoStatus: 'ready' },
      ]
      expect(getPendingVideos(media)).toHaveLength(2)
    })
  })

  describe('getMediaStatus', () => {
    it('should return correct status summary', () => {
      const media: MediaFile[] = [
        { preview: '', url: 'https://a.jpg', type: 'image', uploading: false },
        { preview: '', type: 'image', uploading: true },
        { preview: '', type: 'image', uploading: false, error: 'Failed' },
      ]
      
      const status = getMediaStatus(media)
      
      expect(status.total).toBe(3)
      expect(status.ready).toBe(1)
      expect(status.uploading).toBe(1)
      expect(status.errors).toBe(1)
      expect(status.isAllReady).toBe(false)
    })
  })

  describe('createMediaFromUrl', () => {
    it('should create media from URL', () => {
      const media = createMediaFromUrl('https://example.com/image.jpg')
      
      expect(media.url).toBe('https://example.com/image.jpg')
      expect(media.preview).toBe('https://example.com/image.jpg')
      expect(media.type).toBe('image')
      expect(media.uploading).toBe(false)
    })

    it('should allow overriding type', () => {
      const media = createMediaFromUrl('https://example.com/file', 'video')
      expect(media.type).toBe('video')
    })
  })

  describe('updateMediaAfterUpload', () => {
    it('should update media with upload result', () => {
      const original: MediaFile = {
        preview: 'blob:...',
        type: 'image',
        uploading: true,
      }
      
      const updated = updateMediaAfterUpload(original, {
        url: 'https://cdn.com/image.jpg',
        cloudflareId: 'cf123',
      })
      
      expect(updated.url).toBe('https://cdn.com/image.jpg')
      expect(updated.cloudflareId).toBe('cf123')
      expect(updated.uploading).toBe(false)
      expect(updated.error).toBeUndefined()
    })
  })

  describe('updateMediaAfterError', () => {
    it('should update media with error', () => {
      const original: MediaFile = {
        preview: 'blob:...',
        type: 'image',
        uploading: true,
      }
      
      const updated = updateMediaAfterError(original, 'Upload failed')
      
      expect(updated.uploading).toBe(false)
      expect(updated.error).toBe('Upload failed')
    })
  })
})
