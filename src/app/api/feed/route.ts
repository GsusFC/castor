import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

// Cache en memoria (2 minutos TTL)
const feedCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 2 * 60 * 1000

function getCachedData(key: string) {
  const cached = feedCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  if (cached) {
    feedCache.delete(key)
  }
  return null
}

function setCachedData(key: string, data: unknown) {
  feedCache.set(key, { data, timestamp: Date.now() })
  // Limpiar cache viejo
  if (feedCache.size > 100) {
    const now = Date.now()
    for (const [k, v] of feedCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        feedCache.delete(k)
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'trending'
    const fid = searchParams.get('fid')
    const channel = searchParams.get('channel')
    const cursor = searchParams.get('cursor') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 10)

    const cacheKey = `feed:${type}:${fid}:${channel}:${cursor}:${limit}`
    const cached = getCachedData(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    let result: { casts: unknown[]; next?: { cursor?: string } }

    if (type === 'trending') {
      const response = await neynar.fetchTrendingFeed({
        limit,
        cursor,
      })
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'home' && fid) {
      // Feed algorítmico personalizado (For You)
      const response = await neynar.fetchFeedForYou({
        fid: parseInt(fid),
        limit,
        cursor,
      })
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'following' && fid) {
      const response = await neynar.fetchFeed({
        feedType: 'following',
        fid: parseInt(fid),
        limit,
        cursor,
      })
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'channel' && channel) {
      const response = await neynar.fetchFeed({
        feedType: 'filter',
        filterType: 'channel_id',
        channelId: channel,
        limit,
        cursor,
      })
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else {
      return NextResponse.json({ error: 'Invalid feed type' }, { status: 400 })
    }

    setCachedData(cacheKey, result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Feed API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    )
  }
}
