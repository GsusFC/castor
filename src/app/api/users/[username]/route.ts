import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    
    // Obtener FID del usuario actual para viewer_context
    const session = await getSession()
    const viewerFid = session?.fid

    const cacheControl = viewerFid
      ? 'private, no-store'
      : 'public, s-maxage=60, stale-while-revalidate=120'

    // Check if it's a FID (numeric) or username
    const isFid = /^\d+$/.test(username)

    let user
    if (isFid) {
      const response = await callNeynar('neynar:users:bulk', () =>
        neynar.fetchBulkUsers({
          fids: [parseInt(username)],
          viewerFid, // Incluir viewer para obtener viewer_context
        })
      )
      user = response.users?.[0]
    } else {
      const response = await callNeynar('neynar:users:lookup', () =>
        neynar.lookupUserByUsername({
          username,
          viewerFid, // Incluir viewer para obtener viewer_context
        })
      )
      user = response.user
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const res = NextResponse.json({ user })
    res.headers.set('Cache-Control', cacheControl)
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[User API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  const normalizedPath = url.pathname.replace(/^\/api\/users\/[^/]+$/, '/api/users/:username')
  return `${getClientIP(req)}:${normalizedPath}`
})(handleGET)
