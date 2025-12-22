import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

/**
 * GET /api/users/search?q=username
 * Busca usuarios en Farcaster para autocompletado de mentions
 */
async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 1) {
      return NextResponse.json({ users: [] })
    }

    const response = await callNeynar('neynar:users:search', () =>
      neynar.searchUser({
        q: query,
        limit: 10,
      })
    )

    const users = response.result.users.map(user => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
    }))

    const res = NextResponse.json({ users })
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[API] Error searching users:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)
