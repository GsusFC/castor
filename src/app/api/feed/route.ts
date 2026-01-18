import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'
import { unstable_cache } from 'next/cache'

const CACHE_TAG_TRENDING = 'feed-trending'
const CACHE_TAG_PERSONALIZED = 'feed-personalized' // Usually not cached deeply, or per user
const CACHE_TAG_CHANNEL = 'feed-channel'

// Cache TTLs (in seconds for next.js revalidate)
const REVALIDATE_TRENDING = 5 * 60 // 5 min
const REVALIDATE_CHANNEL = 2 * 60 // 2 min (more dynamic)

type FeedParams = {
  type: 'trending' | 'home' | 'following' | 'channel'
  fid?: number
  channel?: string
  cursor?: string
  limit?: number
}

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

const normalizeCursor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed
}

// Unified Service Function to fetch and process feed
// This function can be wrapped with unstable_cache where appropriate
async function fetchFeedService(params: FeedParams) {
  const { type, fid, channel, cursor, limit = 25 } = params

  let result: { casts: unknown[]; next?: { cursor?: string } }

  if (type === 'trending') {
    const response = await callNeynar('neynar:feed:trending', () =>
      neynar.fetchTrendingFeed({
        limit: Math.min(limit, 10), // Trending max is lower
        cursor,
      })
    )
    result = {
      casts: response.casts || [],
      next: { cursor: normalizeCursor(response.next?.cursor) },
    }
  } else if (type === 'home') {
    if (!fid) throw new Error('fid is required for home feed')
    const response = await callNeynar('neynar:feed:for-you', () =>
      neynar.fetchFeedForYou({
        fid,
        limit,
        cursor,
      })
    )
    result = {
      casts: response.casts || [],
      next: { cursor: normalizeCursor(response.next?.cursor) },
    }
  } else if (type === 'following') {
    if (!fid) throw new Error('fid is required for following feed')
    const response = await callNeynar('neynar:feed:following', () =>
      neynar.fetchFeed({
        feedType: 'following',
        fid,
        withRecasts: false,
        limit,
        cursor,
      })
    )
    result = {
      casts: response.casts || [],
      next: { cursor: normalizeCursor(response.next?.cursor) },
    }
  } else if (type === 'channel') {
    if (!channel) throw new Error('channel is required for channel feed')
    const response = await callNeynar('neynar:feed:channel', () =>
      neynar.fetchFeed({
        feedType: 'filter',
        filterType: 'channel_id',
        channelId: channel,
        limit,
        cursor,
      })
    )
    result = {
      casts: response.casts || [],
      next: { cursor: normalizeCursor(response.next?.cursor) },
    }
  } else {
    throw new Error('Invalid feed type')
  }

  // Process results
  const beforeFilter = (result.casts as any[]).length
  const shouldFilterSpam = type === 'trending'
  const castingCasts = result.casts as any[]

  const castsAfterSpamFilter = shouldFilterSpam
    ? filterSpam(castingCasts)
    : castingCasts

  result.casts = castsAfterSpamFilter.map(sanitizeCast)

  const spamFilteredCount = shouldFilterSpam ? beforeFilter - castsAfterSpamFilter.length : 0
  if (spamFilteredCount > 0) {
    console.log(`[Feed ${type}] Filtered ${spamFilteredCount} spam items`)
  }

  return result
}

// Cached version for public/shared feeds
const getCachedFeed = unstable_cache(
  async (params: FeedParams) => fetchFeedService(params),
  ['feed-data'], // Key parts are added dynamically by Next.js based on arguments? No, strictly need proper keys.
  // Actually unstable_cache arguments are (fn, keyParts, options). Logic must be inside.
  { tags: ['feed'] }
)

// We need a wrapper that decides WHEN to use cache. 
// Personalized feeds (home, following) should NOT be cached sharedly (maybe per user, but unstable_cache is global).
// Trending and Channel CAN be cached globally.

async function getFeedData(params: FeedParams) {
  const isPersonalized = params.type === 'home' || params.type === 'following'

  if (isPersonalized) {
    return fetchFeedService(params)
  }

  // Create unique cache key parts
  const keyParts = [
    'feed',
    params.type,
    params.channel || '',
    params.cursor || 'start',
    String(params.limit)
  ]

  const tags = [params.type === 'channel' ? CACHE_TAG_CHANNEL : CACHE_TAG_TRENDING]
  const revalidate = params.type === 'channel' ? REVALIDATE_CHANNEL : REVALIDATE_TRENDING

  // Use unstable_cache for shared feeds
  return unstable_cache(
    async () => fetchFeedService(params),
    keyParts,
    { revalidate, tags }
  )()
}


async function handleRequest(request: NextRequest, isPost: boolean) {
  try {
    let type, fid, channel, cursor, limit

    if (isPost) {
      const body = await request.json()
      type = body.type
      fid = body.fid
      channel = body.channel
      cursor = body.cursor
      limit = body.limit
    } else {
      const { searchParams } = new URL(request.url)
      type = searchParams.get('type')
      const fidParam = searchParams.get('fid')
      fid = fidParam ? parseInt(fidParam) : undefined
      channel = searchParams.get('channel')
      cursor = searchParams.get('cursor')
      limit = parseInt(searchParams.get('limit') || '25')
    }

    // Default params
    type = type || 'trending'
    limit = limit || 25
    cursor = normalizeCursor(cursor)

    if (!['trending', 'home', 'following', 'channel'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feed type' }, { status: 400 })
    }

    const params: FeedParams = {
      type: type as any,
      fid: typeof fid === 'number' ? fid : undefined,
      channel: typeof channel === 'string' ? channel : undefined,
      cursor,
      limit
    }

    const result = await getFeedData(params)

    const response = NextResponse.json(result)

    // Set browser caching headers
    const isPersonalized = type === 'home' || type === 'following'
    if (isPersonalized) {
      response.headers.set('Cache-Control', 'private, no-store')
    } else {
      // Align browser cache with server revalidate time
      const maxAge = type === 'channel' ? REVALIDATE_CHANNEL : REVALIDATE_TRENDING
      const swr = maxAge * 2
      response.headers.set('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`)
    }

    return response

  } catch (error: any) {
    if (error.message?.startsWith('Circuit breaker')) {
      return NextResponse.json({ error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' }, { status: 503 })
    }

    console.error('[Feed API] Error:', error)
    const status = error.message?.includes('required') ? 400 : 500
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status })
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(async (req) => handleRequest(req, false))

export const POST = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(async (req) => handleRequest(req, true))


// --- Helpers ---

// Filtro Priority Mode (simula comportamiento de Warpcast)
// Solo muestra: power badge, Pro, o usuarios establecidos
function filterSpam(casts: any[]): any[] {
  return casts.filter((cast) => {
    const author = cast.author
    if (!author) return false

    const followerCount = author.follower_count ?? 0
    const isPro = author.pro?.status === 'subscribed'

    // 1. Power badge = siempre visible
    if (author.power_badge) return true

    // 2. Usuarios Pro = siempre visible
    if (isPro) return true

    // 3. Filtrar cuentas sin username o con username inválido
    if (!author.username || author.username.startsWith('!')) {
      return false
    }

    // 4. Usuarios establecidos (>100 followers) = visible
    if (followerCount >= 100) return true

    // 5. Usuarios con buen ratio following/followers (no bots de follow masivo)
    const followingCount = author.following_count ?? 0
    if (followerCount >= 50 && followingCount < followerCount * 10) return true

    // 6. Todo lo demás = filtrado como spam potencial
    return false
  })
}

// Limpia el objeto Cast para enviar solo lo necesario al cliente
function sanitizeCast(cast: any): any {
  if (!cast) return null

  return {
    hash: cast.hash,
    parent_hash: cast.parent_hash,
    parent_url: cast.parent_url,
    thread_hash: cast.thread_hash,
    text: cast.text,
    timestamp: cast.timestamp,
    author: {
      fid: cast.author?.fid,
      username: cast.author?.username,
      display_name: cast.author?.display_name,
      pfp_url: cast.author?.pfp_url,
      power_badge: cast.author?.power_badge,
      pro: cast.author?.pro,
    },
    reactions: {
      likes_count: cast.reactions?.likes_count || 0,
      recasts_count: cast.reactions?.recasts_count || 0,
    },
    replies: {
      count: cast.replies?.count || 0,
    },
    embeds: cast.embeds?.map((e: any) => ({
      url: e.url,
      cast: e.cast ? sanitizeCast(e.cast) : undefined,
      metadata: e.metadata, // Mantenemos metadata por ahora para renderizado de embeds
    })),
    channel: cast.channel ? {
      id: cast.channel.id,
      name: cast.channel.name,
      image_url: cast.channel.image_url,
    } : undefined,
  }
}
