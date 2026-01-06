import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { CastItem, MediaFile, LinkEmbed } from '@/components/compose/types'
import {
  serializeMedia,
  serializeLink,
  serializeCast,
  serializeDraft,
  serializeForApi,
  deserializeMedia,
  deserializeLink,
  deserializeCast,
  deserializeDraft,
  createEmptyCast,
  createCast,
  createDraftMetadata,
  saveLocalDraft,
  loadLocalDraft,
  clearLocalDraft,
  hasLocalDraft,
  cloneCast,
  cloneCasts,
} from './serialization'

describe('serialization', () => {
  describe('serializeMedia', () => {
    it('should serialize media with URL', () => {
      const media: MediaFile = {
        preview: 'blob:...',
        url: 'https://cdn.com/image.jpg',
        type: 'image',
        uploading: false,
        cloudflareId: 'cf123',
      }
      
      const serialized = serializeMedia(media)
      
      expect(serialized).not.toBeNull()
      expect(serialized!.url).toBe('https://cdn.com/image.jpg')
      expect(serialized!.type).toBe('image')
      expect(serialized!.cloudflareId).toBe('cf123')
    })

    it('should return null for media without URL', () => {
      const media: MediaFile = {
        preview: 'blob:...',
        type: 'image',
        uploading: true,
      }
      
      expect(serializeMedia(media)).toBeNull()
    })
  })

  describe('serializeLink', () => {
    it('should serialize link embed', () => {
      const link: LinkEmbed = {
        url: 'https://example.com',
        title: 'Example',
        description: 'Description',
        loading: true, // Should be stripped
      }
      
      const serialized = serializeLink(link)
      
      expect(serialized.url).toBe('https://example.com')
      expect(serialized.title).toBe('Example')
      expect((serialized as unknown as Record<string, unknown>).loading).toBeUndefined()
    })
  })

  describe('serializeCast', () => {
    it('should serialize cast with media and links', () => {
      const cast: CastItem = {
        id: 'cast1',
        content: 'Hello world',
        media: [
          { preview: '', url: 'https://img.jpg', type: 'image', uploading: false },
          { preview: '', type: 'image', uploading: true }, // Should be filtered out
        ],
        links: [{ url: 'https://link.com', loading: true }],
      }
      
      const serialized = serializeCast(cast)
      
      expect(serialized.id).toBe('cast1')
      expect(serialized.content).toBe('Hello world')
      expect(serialized.media).toHaveLength(1) // Only media with URL
      expect(serialized.links).toHaveLength(1)
    })
  })

  describe('serializeDraft', () => {
    it('should serialize complete draft with metadata', () => {
      const casts: CastItem[] = [
        { id: '1', content: 'Test', media: [], links: [] },
      ]
      
      const draft = serializeDraft(casts, {
        id: 'draft1',
        accountId: 'acc1',
        channelId: 'channel1',
      })
      
      expect(draft.version).toBe(1)
      expect(draft.metadata.id).toBe('draft1')
      expect(draft.metadata.accountId).toBe('acc1')
      expect(draft.metadata.createdAt).toBeDefined()
      expect(draft.casts).toHaveLength(1)
    })
  })

  describe('serializeForApi', () => {
    it('should serialize casts for API submission', () => {
      const casts: CastItem[] = [
        {
          id: '1',
          content: 'Hello',
          media: [{ preview: '', url: 'https://img.jpg', type: 'image', uploading: false }],
          links: [{ url: 'https://link.com' }],
        },
      ]
      
      const result = serializeForApi(casts)
      
      expect(result.casts).toHaveLength(1)
      expect(result.casts[0].content).toBe('Hello')
      expect(result.casts[0].embeds).toHaveLength(2)
    })

    it('should exclude metadata when specified', () => {
      const casts: CastItem[] = [
        {
          id: '1',
          content: 'Hello',
          media: [{ 
            preview: '', 
            url: 'https://img.jpg', 
            type: 'image', 
            uploading: false,
            cloudflareId: 'cf123',
          }],
          links: [],
        },
      ]
      
      const result = serializeForApi(casts, { includeMetadata: false })
      
      expect(result.casts[0].embeds[0]).toEqual({ url: 'https://img.jpg' })
    })
  })

  describe('deserializeMedia', () => {
    it('should deserialize media back to MediaFile', () => {
      const serialized = {
        url: 'https://img.jpg',
        type: 'image' as const,
        cloudflareId: 'cf123',
      }
      
      const media = deserializeMedia(serialized)
      
      expect(media.url).toBe('https://img.jpg')
      expect(media.preview).toBe('https://img.jpg')
      expect(media.uploading).toBe(false)
      expect(media.cloudflareId).toBe('cf123')
    })
  })

  describe('deserializeLink', () => {
    it('should deserialize link back to LinkEmbed', () => {
      const serialized = {
        url: 'https://example.com',
        title: 'Example',
      }
      
      const link = deserializeLink(serialized)
      
      expect(link.url).toBe('https://example.com')
      expect(link.title).toBe('Example')
      expect(link.loading).toBe(false)
      expect(link.error).toBe(false)
    })
  })

  describe('deserializeCast', () => {
    it('should deserialize cast back to CastItem', () => {
      const serialized = {
        id: 'cast1',
        content: 'Hello',
        media: [{ url: 'https://img.jpg', type: 'image' as const }],
        links: [{ url: 'https://link.com' }],
      }
      
      const cast = deserializeCast(serialized)
      
      expect(cast.id).toBe('cast1')
      expect(cast.content).toBe('Hello')
      expect(cast.media).toHaveLength(1)
      expect(cast.links).toHaveLength(1)
    })
  })

  describe('deserializeDraft', () => {
    it('should deserialize complete draft', () => {
      const serialized = {
        version: 1,
        metadata: {
          id: 'draft1',
          accountId: 'acc1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        casts: [
          { id: '1', content: 'Test', media: [], links: [] },
        ],
      }
      
      const result = deserializeDraft(serialized)
      
      expect(result.metadata.id).toBe('draft1')
      expect(result.casts).toHaveLength(1)
    })
  })

  describe('createEmptyCast', () => {
    it('should create empty cast with ID', () => {
      const cast = createEmptyCast()
      
      expect(cast.id).toBeDefined()
      expect(cast.content).toBe('')
      expect(cast.media).toEqual([])
      expect(cast.links).toEqual([])
    })
  })

  describe('createCast', () => {
    it('should create cast with content', () => {
      const cast = createCast('Hello world')
      
      expect(cast.id).toBeDefined()
      expect(cast.content).toBe('Hello world')
    })

    it('should create cast with media and links', () => {
      const media: MediaFile[] = [{ preview: '', type: 'image', uploading: false }]
      const links: LinkEmbed[] = [{ url: 'https://example.com' }]
      
      const cast = createCast('Hello', media, links)
      
      expect(cast.media).toHaveLength(1)
      expect(cast.links).toHaveLength(1)
    })
  })

  describe('createDraftMetadata', () => {
    it('should create metadata with timestamps', () => {
      const metadata = createDraftMetadata('acc1')
      
      expect(metadata.id).toBeDefined()
      expect(metadata.accountId).toBe('acc1')
      expect(metadata.createdAt).toBeDefined()
      expect(metadata.updatedAt).toBeDefined()
    })
  })

  describe('localStorage helpers', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it('should save and load draft from localStorage', () => {
      const draft = {
        version: 1,
        metadata: {
          id: 'draft1',
          accountId: 'acc1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        casts: [{ id: '1', content: 'Test', media: [], links: [] }],
      }
      
      saveLocalDraft(draft)
      const loaded = loadLocalDraft()
      
      expect(loaded).toEqual(draft)
    })

    it('should return null when no draft exists', () => {
      expect(loadLocalDraft()).toBeNull()
    })

    it('should clear local draft', () => {
      const draft = {
        version: 1,
        metadata: {
          id: 'draft1',
          accountId: 'acc1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        casts: [],
      }
      
      saveLocalDraft(draft)
      expect(hasLocalDraft()).toBe(true)
      
      clearLocalDraft()
      expect(hasLocalDraft()).toBe(false)
    })
  })

  describe('cloneCast', () => {
    it('should create deep clone with new ID', () => {
      const original: CastItem = {
        id: 'orig1',
        content: 'Hello',
        media: [{ preview: '', type: 'image', uploading: false }],
        links: [{ url: 'https://example.com' }],
      }
      
      const clone = cloneCast(original)
      
      expect(clone.id).not.toBe(original.id)
      expect(clone.content).toBe(original.content)
      expect(clone.media).not.toBe(original.media) // Different reference
      expect(clone.media[0]).not.toBe(original.media[0]) // Different reference
    })
  })

  describe('cloneCasts', () => {
    it('should clone array of casts', () => {
      const originals: CastItem[] = [
        { id: '1', content: 'One', media: [], links: [] },
        { id: '2', content: 'Two', media: [], links: [] },
      ]
      
      const clones = cloneCasts(originals)
      
      expect(clones).toHaveLength(2)
      expect(clones[0].id).not.toBe(originals[0].id)
      expect(clones[1].id).not.toBe(originals[1].id)
    })
  })
})
