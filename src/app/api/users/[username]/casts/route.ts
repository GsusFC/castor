import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
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
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor') || undefined
    const type = searchParams.get('type') || 'casts'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    // First get user FID
    const userResponse = await callNeynar('neynar:users:lookup', () => neynar.lookupUserByUsername({ username }))
    if (!userResponse.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const fid = userResponse.user.fid

    let result: { casts: any[]; next?: { cursor?: string } }

    if (type === 'casts') {
      // User's casts (excluding replies)
      const response = await callNeynar('neynar:users:casts', () =>
        neynar.fetchFeed({
          feedType: 'filter',
          filterType: 'fids',
          fids: String(fid),
          limit,
          cursor,
        })
      )
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'replies') {
      // User's replies
      const response = await callNeynar('neynar:users:replies', () =>
        neynar.fetchRepliesAndRecastsForUser({
          fid,
          filter: 'replies',
          limit,
          cursor,
        })
      )
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'likes') {
      // User's likes
      const response = await callNeynar('neynar:users:likes', () =>
        neynar.fetchUserReactions({
          fid,
          type: 'likes',
          limit,
          cursor,
        })
      )
      result = {
        casts: (response.reactions || []).map((r: any) => r.cast).filter(Boolean),
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const res = NextResponse.json(result)
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[User Casts API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch casts' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  const normalizedPath = url.pathname.replace(/^\/api\/users\/[^/]+\/casts$/, '/api/users/:username/casts')
  return `${getClientIP(req)}:${normalizedPath}`
})(handleGET)
