import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

/**
 * GET /api/social/[fid]/following
 * Obtener lista de usuarios que sigue
 */
async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params
    const targetFid = parseInt(fid)
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)

    if (isNaN(targetFid)) {
      return NextResponse.json({ error: 'Invalid FID' }, { status: 400 })
    }

    const response = await callNeynar('neynar:social:following', () =>
      neynar.fetchUserFollowing({
        fid: targetFid,
        limit,
        cursor,
      })
    )

    const following = response.users.map((user: any) => ({
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      follower_count: user.follower_count,
      following_count: user.following_count,
      power_badge: user.power_badge,
      bio: user.profile?.bio?.text,
    }))

    const res = NextResponse.json({
      users: following,
      next: response.next,
    })
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[Following] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 })
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  const normalizedPath = url.pathname.replace(/^\/api\/social\/[^/]+\/following$/, '/api/social/:fid/following')
  return `${getClientIP(req)}:${normalizedPath}`
})(handleGET)
