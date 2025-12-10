import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

// Cache en memoria (30 segundos TTL)
const feedCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 30 * 1000

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
    } else if (type === 'home') {
      // Feed algorítmico personalizado (For You)
      if (!fid) {
        // Si no hay fid, usar trending como fallback
        const response = await neynar.fetchTrendingFeed({ limit, cursor })
        result = {
          casts: response.casts || [],
          next: { cursor: response.next?.cursor ?? undefined },
        }
      } else {
        const response = await neynar.fetchFeedForYou({
          fid: parseInt(fid),
          limit,
          cursor,
        })
        result = {
          casts: response.casts || [],
          next: { cursor: response.next?.cursor ?? undefined },
        }
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

    // Aplicar filtro de spam
    const beforeFilter = (result.casts as any[]).length
    result.casts = filterSpam(result.casts as any[])
    console.log(`[Feed] Filtered ${beforeFilter - (result.casts as any[]).length} spam casts (${beforeFilter} → ${(result.casts as any[]).length})`)
    
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
