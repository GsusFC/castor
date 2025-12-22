import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

interface Channel {
  id: string
  name: string
  image_url?: string
  description?: string
}

interface NeynarChannel {
  id: string
  name?: string
  image_url?: string
  description?: string
}

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const fid = searchParams.get('fid')

    const cacheControl = fid
      ? 'private, no-store'
      : 'public, s-maxage=60, stale-while-revalidate=120'

    let channels: Channel[] = []

    if (query && query.length >= 2) {
      // Buscar canales por nombre
      const response = await callNeynar('neynar:channels:search', () => neynar.searchChannels({ q: query, limit: 30 }))
      channels = response.channels
        .filter((channel): channel is typeof channel & { name: string } => !!channel.name)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          image_url: channel.image_url,
          description: channel.description,
        }))
    } else if (fid) {
      // Obtener canales que sigue el usuario con paginación
      let cursor: string | undefined
      let allRawChannels: unknown[] = []
      
      // Máximo 3 páginas de 100 canales = 300 canales
      for (let page = 0; page < 3; page++) {
        const response = await callNeynar('neynar:channels:user', () =>
          neynar.fetchUserChannels({
            fid: Number(fid),
            limit: 100,
            cursor,
          })
        )
        
        const pageChannels = response.channels || []
        allRawChannels = [...allRawChannels, ...pageChannels]
        
        // Si no hay más páginas, salir
        cursor = response.next?.cursor ?? undefined
        if (!cursor || pageChannels.length < 100) break
      }
      
      // La respuesta puede tener diferentes estructuras según la API
      const mappedChannels: (Channel | null)[] = allRawChannels.map((item: unknown) => {
        // Puede ser directamente el canal o un objeto con .channel
        const ch = (item as { channel?: NeynarChannel })?.channel || (item as NeynarChannel)
        if (!ch?.id || !ch?.name) return null
        return {
          id: ch.id,
          name: ch.name,
          image_url: ch.image_url,
          description: ch.description,
        }
      })
      channels = mappedChannels.filter((ch): ch is Channel => ch !== null)
    } else {
      // Sin fid, buscar canales populares
      const response = await callNeynar('neynar:channels:search', () => neynar.searchChannels({ q: 'farcaster', limit: 30 }))
      channels = response.channels
        .filter((channel): channel is typeof channel & { name: string } => !!channel.name)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          image_url: channel.image_url,
          description: channel.description,
        }))
    }

    const formattedChannels = channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      imageUrl: channel.image_url,
      description: channel.description,
    }))

    const res = NextResponse.json({ channels: formattedChannels })
    res.headers.set('Cache-Control', cacheControl)
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[API] Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)
