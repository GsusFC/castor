import { describe, it, expect } from 'vitest'
import {
  isMediaEmbed,
  parseMediaFromEmbeds,
  parseLinksFromEmbeds,
  parseEditCastToCastItem,
  type RawEmbed,
} from './parse-edit-data'

describe('isMediaEmbed', () => {
  it('should return true for cloudflare images', () => {
    const embed: RawEmbed = {
      url: 'https://imagedelivery.net/abc/123/public',
      type: 'image',
    }
    expect(isMediaEmbed(embed)).toBe(true)
  })

  it('should return true for embed with cloudflareId', () => {
    const embed: RawEmbed = {
      url: 'https://example.com/image',
      type: 'image',
      cloudflareId: 'cf-123',
    }
    expect(isMediaEmbed(embed)).toBe(true)
  })

  it('should return true for livepeer videos', () => {
    const embed: RawEmbed = {
      url: 'https://lp-playback.com/video.m3u8',
      type: 'video',
    }
    expect(isMediaEmbed(embed)).toBe(true)
  })

  it('should return true for embed with livepeerAssetId', () => {
    const embed: RawEmbed = {
      url: 'https://example.com/video',
      type: 'video',
      livepeerAssetId: 'lp-123',
    }
    expect(isMediaEmbed(embed)).toBe(true)
  })

  it('should return true for URLs with media extensions', () => {
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'm3u8']
    extensions.forEach((ext) => {
      const embed: RawEmbed = {
        url: `https://example.com/file.${ext}`,
        type: ext === 'mp4' || ext === 'mov' || ext === 'webm' || ext === 'm3u8' ? 'video' : 'image',
      }
      expect(isMediaEmbed(embed)).toBe(true)
    })
  })

  it('should return false for regular URLs', () => {
    const embed: RawEmbed = {
      url: 'https://example.com/article',
      type: 'image',
    }
    expect(isMediaEmbed(embed)).toBe(false)
  })
})

describe('parseMediaFromEmbeds', () => {
  it('should filter and parse media embeds', () => {
    const embeds: RawEmbed[] = [
      {
        url: 'https://imagedelivery.net/abc/123/public',
        type: 'image',
        cloudflareId: 'cf-123',
        thumbnailUrl: 'https://thumb.com/1.jpg',
      },
      {
        url: 'https://example.com/article',
        type: 'image',
      },
    ]
    const result = parseMediaFromEmbeds(embeds)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      preview: 'https://thumb.com/1.jpg',
      url: 'https://imagedelivery.net/abc/123/public',
      type: 'image',
      uploading: false,
      cloudflareId: 'cf-123',
      livepeerAssetId: undefined,
      livepeerPlaybackId: undefined,
      videoStatus: undefined,
    })
  })

  it('should use url as preview if thumbnailUrl is missing', () => {
    const embeds: RawEmbed[] = [
      {
        url: 'https://imagedelivery.net/abc/123/public',
        type: 'image',
        cloudflareId: 'cf-123',
      },
    ]
    const result = parseMediaFromEmbeds(embeds)
    expect(result[0].preview).toBe('https://imagedelivery.net/abc/123/public')
  })
})

describe('parseLinksFromEmbeds', () => {
  it('should filter and parse link embeds', () => {
    const embeds: RawEmbed[] = [
      {
        url: 'https://imagedelivery.net/abc/123/public',
        type: 'image',
        cloudflareId: 'cf-123',
      },
      {
        url: 'https://example.com/article',
        type: 'image',
      },
    ]
    const result = parseLinksFromEmbeds(embeds)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ url: 'https://example.com/article' })
  })
})

describe('parseEditCastToCastItem', () => {
  it('should parse edit cast data to CastItem', () => {
    const editCast = {
      id: 'cast-123',
      content: 'Hello world',
      accountId: 'acc-123',
      channelId: 'channel-1',
      scheduledAt: '2024-01-01T12:00:00Z',
      media: [
        {
          url: 'https://imagedelivery.net/abc/123/public',
          type: 'image' as const,
          cloudflareId: 'cf-123',
        },
        {
          url: 'https://example.com/article',
          type: 'image' as const,
        },
      ],
    }
    const result = parseEditCastToCastItem(editCast)
    expect(result.id).toBe('cast-123')
    expect(result.content).toBe('Hello world')
    expect(result.media).toHaveLength(1)
    expect(result.links).toHaveLength(1)
  })

  it('should handle missing media array', () => {
    const editCast = {
      id: 'cast-123',
      content: 'Hello world',
      accountId: 'acc-123',
      scheduledAt: '2024-01-01T12:00:00Z',
    }
    const result = parseEditCastToCastItem(editCast)
    expect(result.media).toEqual([])
    expect(result.links).toEqual([])
  })
})
