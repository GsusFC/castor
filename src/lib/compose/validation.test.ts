import { describe, it, expect } from 'vitest'
import {
  hasMediaIssues,
  hasPendingVideos,
  validateMediaReady,
  hasContent,
  canPublish,
} from './validation'
import type { CastItem } from '@/components/compose/types'

const createCast = (overrides: Partial<CastItem> = {}): CastItem => ({
  id: '1',
  content: '',
  media: [],
  links: [],
  ...overrides,
})

describe('hasMediaIssues', () => {
  it('should return false for empty casts', () => {
    expect(hasMediaIssues([])).toBe(false)
  })

  it('should return false when no media has issues', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', url: 'https://img.com/1.jpg', type: 'image' }],
      }),
    ]
    expect(hasMediaIssues(casts)).toBe(false)
  })

  it('should return true when media is uploading', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', type: 'image', uploading: true }],
      }),
    ]
    expect(hasMediaIssues(casts)).toBe(true)
  })

  it('should return true when media has error', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', type: 'image', error: 'Upload failed' }],
      }),
    ]
    expect(hasMediaIssues(casts)).toBe(true)
  })
})

describe('hasPendingVideos', () => {
  it('should return false for empty casts', () => {
    expect(hasPendingVideos([])).toBe(false)
  })

  it('should return false for images', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', url: 'https://img.com/1.jpg', type: 'image' }],
      }),
    ]
    expect(hasPendingVideos(casts)).toBe(false)
  })

  it('should return false for ready videos', () => {
    const casts = [
      createCast({
        media: [
          {
            preview: 'blob:1',
            url: 'https://vid.com/1.mp4',
            type: 'video',
            videoStatus: 'ready',
          },
        ],
      }),
    ]
    expect(hasPendingVideos(casts)).toBe(false)
  })

  it('should return true for pending videos', () => {
    const casts = [
      createCast({
        media: [
          {
            preview: 'blob:1',
            url: 'https://vid.com/1.mp4',
            type: 'video',
            videoStatus: 'pending',
          },
        ],
      }),
    ]
    expect(hasPendingVideos(casts)).toBe(true)
  })
})

describe('validateMediaReady', () => {
  it('should return null when media is ready', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', url: 'https://img.com/1.jpg', type: 'image' }],
      }),
    ]
    expect(validateMediaReady(casts)).toBeNull()
  })

  it('should return error message when media is uploading', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', type: 'image', uploading: true }],
      }),
    ]
    expect(validateMediaReady(casts)).toBe(
      'Please wait for uploads to finish or remove failed files'
    )
  })
})

describe('hasContent', () => {
  it('should return false for empty content', () => {
    const casts = [createCast({ content: '' })]
    expect(hasContent(casts)).toBe(false)
  })

  it('should return false for whitespace only', () => {
    const casts = [createCast({ content: '   ' })]
    expect(hasContent(casts)).toBe(false)
  })

  it('should return true for content with text', () => {
    const casts = [createCast({ content: 'Hello world' })]
    expect(hasContent(casts)).toBe(true)
  })

  it('should return true if any cast has content', () => {
    const casts = [
      createCast({ content: '' }),
      createCast({ content: 'Second cast' }),
    ]
    expect(hasContent(casts)).toBe(true)
  })
})

describe('canPublish', () => {
  it('should return false for empty cast', () => {
    const casts = [createCast()]
    expect(canPublish(casts)).toBe(false)
  })

  it('should return true for cast with text', () => {
    const casts = [createCast({ content: 'Hello' })]
    expect(canPublish(casts)).toBe(true)
  })

  it('should return true for cast with media', () => {
    const casts = [
      createCast({
        media: [{ preview: 'blob:1', url: 'https://img.com/1.jpg', type: 'image' }],
      }),
    ]
    expect(canPublish(casts)).toBe(true)
  })

  it('should return true for cast with links', () => {
    const casts = [
      createCast({
        links: [{ url: 'https://link.com' }],
      }),
    ]
    expect(canPublish(casts)).toBe(true)
  })
})
