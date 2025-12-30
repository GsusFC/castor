import { describe, it, expect } from 'vitest'
import {
  buildEmbedsFromCast,
  buildMediaEmbeds,
  buildLinkEmbeds,
  buildThreadEmbedsPayload,
} from './embeds'
import type { CastItem, MediaFile, LinkEmbed } from '@/components/compose/types'

describe('buildMediaEmbeds', () => {
  it('should return empty array for empty media', () => {
    expect(buildMediaEmbeds([])).toEqual([])
  })

  it('should filter out media without URL', () => {
    const media: MediaFile[] = [
      { preview: 'blob:123', type: 'image', uploading: true },
      { preview: 'blob:456', url: 'https://example.com/image.jpg', type: 'image' },
    ]
    const result = buildMediaEmbeds(media)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://example.com/image.jpg')
  })

  it('should include metadata by default', () => {
    const media: MediaFile[] = [
      {
        preview: 'blob:123',
        url: 'https://example.com/video.mp4',
        type: 'video',
        cloudflareId: 'cf-123',
        videoStatus: 'ready',
      },
    ]
    const result = buildMediaEmbeds(media, true)
    expect(result[0]).toEqual({
      url: 'https://example.com/video.mp4',
      type: 'video',
      cloudflareId: 'cf-123',
      videoStatus: 'ready',
      livepeerAssetId: undefined,
      livepeerPlaybackId: undefined,
    })
  })

  it('should exclude metadata when includeMetadata is false', () => {
    const media: MediaFile[] = [
      {
        preview: 'blob:123',
        url: 'https://example.com/video.mp4',
        type: 'video',
        cloudflareId: 'cf-123',
      },
    ]
    const result = buildMediaEmbeds(media, false)
    expect(result[0]).toEqual({ url: 'https://example.com/video.mp4' })
  })
})

describe('buildLinkEmbeds', () => {
  it('should return empty array for empty links', () => {
    expect(buildLinkEmbeds([])).toEqual([])
  })

  it('should normalize URLs', () => {
    const links: LinkEmbed[] = [
      { url: 'example.com/page' },
      { url: 'https://another.com' },
    ]
    const result = buildLinkEmbeds(links)
    expect(result[0].url).toBe('https://example.com/page')
    expect(result[1].url).toBe('https://another.com')
  })
})

describe('buildEmbedsFromCast', () => {
  it('should combine media and links', () => {
    const cast: CastItem = {
      id: '1',
      content: 'Test',
      media: [
        { preview: 'blob:1', url: 'https://img.com/1.jpg', type: 'image' },
      ],
      links: [{ url: 'https://link.com' }],
    }
    const result = buildEmbedsFromCast(cast)
    expect(result).toHaveLength(2)
    expect(result[0].url).toBe('https://img.com/1.jpg')
    expect(result[1].url).toBe('https://link.com')
  })

  it('should respect includeMetadata option', () => {
    const cast: CastItem = {
      id: '1',
      content: 'Test',
      media: [
        {
          preview: 'blob:1',
          url: 'https://img.com/1.jpg',
          type: 'image',
          cloudflareId: 'cf-123',
        },
      ],
      links: [],
    }
    const result = buildEmbedsFromCast(cast, { includeMetadata: false })
    expect(result[0]).toEqual({ url: 'https://img.com/1.jpg' })
  })
})

describe('buildThreadEmbedsPayload', () => {
  it('should build payload for multiple casts', () => {
    const casts: CastItem[] = [
      {
        id: '1',
        content: 'First cast',
        media: [{ preview: 'blob:1', url: 'https://img.com/1.jpg', type: 'image' }],
        links: [],
      },
      {
        id: '2',
        content: 'Second cast',
        media: [],
        links: [{ url: 'https://link.com' }],
      },
    ]
    const result = buildThreadEmbedsPayload(casts)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('First cast')
    expect(result[0].embeds).toHaveLength(1)
    expect(result[1].content).toBe('Second cast')
    expect(result[1].embeds).toHaveLength(1)
  })
})
