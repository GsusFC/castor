import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

type NeynarChannel = {
  id?: string
  name?: string
  image_url?: string
  follower_count?: number
  description?: string
}

type NeynarUserChannelMembership = {
  channel?: NeynarChannel
  id?: string
  name?: string
  image_url?: string
  follower_count?: number
  description?: string
}

type NeynarFetchUserChannelMembershipsResponse = {
  members?: NeynarUserChannelMembership[]
  channels?: NeynarUserChannelMembership[]
  next?: {
    cursor?: string
  }
}

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

async function handleGET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.fid) {
      return NextResponse.json({ channels: [] })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    // Paginar para obtener todos los canales
    const allMemberships: NeynarUserChannelMembership[] = []
    let cursor: string | undefined
    const pageSize = 100 // Máximo por página de Neynar

    do {
      const response = await callNeynar<NeynarFetchUserChannelMembershipsResponse>('neynar:channels:memberships', async () =>
        (await neynar.fetchUserChannelMemberships({
          fid: session.fid,
          limit: pageSize,
          cursor,
        })) as unknown as NeynarFetchUserChannelMembershipsResponse
      )

      const memberships = response.members ?? response.channels ?? []
      allMemberships.push(...memberships)
      
      cursor = response.next?.cursor
      
      // Parar si ya tenemos suficientes o no hay más
      if (allMemberships.length >= limit || !cursor) break
    } while (cursor)

    const channels = allMemberships
      .slice(0, limit)
      .map((membership) => {
        const channel = membership.channel ?? membership
        if (!channel.id || !channel.name) return null
        return {
          id: channel.id,
          name: channel.name,
          image_url: channel.image_url,
          follower_count: channel.follower_count,
          description: channel.description,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    const res = NextResponse.json({ channels })
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('Error fetching user channels:', error)
    return NextResponse.json(
      { error: 'Error fetching channels' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)
