import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

// Cache en memoria (1 minuto TTL para mejor performance)
const feedCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60 * 1000

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

const normalizeCursor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed
}

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
      console.log(`[Spam] Filtered ${author.username} - invalid username`)
      return false
    }

    // 4. Usuarios establecidos (>100 followers) = visible
    if (followerCount >= 100) return true

    // 5. Usuarios con buen ratio following/followers (no bots de follow masivo)
    const followingCount = author.following_count ?? 0
    if (followerCount >= 50 && followingCount < followerCount * 10) return true

    // 6. Todo lo demás = filtrado como spam potencial
    console.log(`[Spam] Filtered @${author.username} - ${followerCount} followers, pro: ${isPro}`)
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

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'trending'
    const fid = searchParams.get('fid')
    const channel = searchParams.get('channel')
    const cursor = normalizeCursor(searchParams.get('cursor'))
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 10)

    const isPersonalized = (type === 'home' || type === 'following') && !!fid
    const cacheControl = isPersonalized
      ? 'private, no-store'
      : 'public, s-maxage=30, stale-while-revalidate=60'

    const cacheKey = `feed:${type}:${fid}:${channel}:${cursor}:${limit}`
    const cached = isPersonalized ? null : getCachedData(cacheKey)
    if (cached) {
      const response = NextResponse.json(cached)
      response.headers.set('Cache-Control', cacheControl)
      return response
    }

    let result: { casts: unknown[]; next?: { cursor?: string } }

    if (type === 'trending') {
      const response = await callNeynar('neynar:feed:trending', () =>
        neynar.fetchTrendingFeed({
        limit,
        cursor,
        })
      )
      result = {
        casts: response.casts || [],
        next: { cursor: normalizeCursor(response.next?.cursor) },
      }
    } else if (type === 'home') {
      // Feed algorítmico personalizado (For You)
      if (!fid) {
        return NextResponse.json(
          { error: 'fid is required for home feed' },
          { status: 400 }
        )
      } else {
        const response = await callNeynar('neynar:feed:for-you', () =>
          neynar.fetchFeedForYou({
            fid: parseInt(fid),
            limit,
            cursor,
          })
        )
        result = {
          casts: response.casts || [],
          next: { cursor: normalizeCursor(response.next?.cursor) },
        }
      }
    } else if (type === 'following' && fid) {
      const response = await callNeynar('neynar:feed:following', () =>
        neynar.fetchFeed({
          feedType: 'following',
          fid: parseInt(fid),
          limit,
          cursor,
        })
      )
      result = {
        casts: response.casts || [],
        next: { cursor: normalizeCursor(response.next?.cursor) },
      }
    } else if (type === 'channel' && channel) {
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
      return NextResponse.json({ error: 'Invalid feed type' }, { status: 400 })
    }

    // Aplicar filtro de spam y sanitización
    const beforeFilter = (result.casts as any[]).length
    const shouldFilterSpam = type === 'trending'
    const castsAfterSpamFilter = shouldFilterSpam
      ? filterSpam(result.casts as any[])
      : (result.casts as any[])
    result.casts = castsAfterSpamFilter.map(sanitizeCast)

    const spamFilteredCount = shouldFilterSpam ? beforeFilter - castsAfterSpamFilter.length : 0
    console.log(`[Feed] Processed ${beforeFilter} casts: ${spamFilteredCount} spam filtered, ${castsAfterSpamFilter.length} sanitized`)

    if (!isPersonalized) setCachedData(cacheKey, result)
    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', cacheControl)
    return response
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[Feed API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)
