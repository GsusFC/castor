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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession()
    const viewerFid = session?.fid

    const cacheControl = viewerFid
      ? 'private, no-store'
      : 'public, s-maxage=60, stale-while-revalidate=120'

    const response = await callNeynar('neynar:channels:lookup', () => neynar.lookupChannel({ id, viewerFid }))

    if (!response.channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Type assertion para acceder a campos adicionales
    const channel = response.channel as typeof response.channel & {
      header_image_url?: string
      member_count?: number
      viewer_context?: { following: boolean }
    }

    const res = NextResponse.json({
      channel: {
        id: channel.id,
        name: channel.name,
        image_url: channel.image_url,
        header_image_url: channel.header_image_url,
        description: channel.description,
        follower_count: channel.follower_count,
        member_count: channel.member_count,
      },
      viewerContext: {
        following: channel.viewer_context?.following ?? false,
      },
    })
    res.headers.set('Cache-Control', cacheControl)
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[API] Error looking up channel:', error)
    return NextResponse.json(
      { error: 'Failed to lookup channel' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  const normalizedPath = url.pathname.replace(/^\/api\/channels\/[^/]+$/, '/api/channels/:id')
  return `${getClientIP(req)}:${normalizedPath}`
})(handleGET)
