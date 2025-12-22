import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const response = await callNeynar('neynar:channels:trending', () =>
      neynar.fetchTrendingChannels({ limit })
    )

    const channels = response.channels?.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      image_url: channel.image_url,
      follower_count: channel.follower_count,
      description: channel.description,
    })) || []

    const res = NextResponse.json({ channels })
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('Error fetching trending channels:', error)
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
