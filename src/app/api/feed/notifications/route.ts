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
    const fid = searchParams.get('fid')
    const cursor = searchParams.get('cursor') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50)

    if (!fid) {
      return NextResponse.json({ error: 'fid is required' }, { status: 400 })
    }

    const response = await callNeynar('neynar:notifications', () =>
      neynar.fetchAllNotifications({
        fid: parseInt(fid),
        cursor,
      })
    )

    // Mapear y normalizar notificaciones con badges
    const notifications = (response.notifications || []).map((n) => ({
      ...n,
      badge: getBadgeType(n.type),
    }))

    const res = NextResponse.json({
      notifications,
      next: { cursor: response.next?.cursor ?? undefined },
    })
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[Notifications API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)

function getBadgeType(type: string): { label: string; icon: string; color: string } {
  const badges: Record<string, { label: string; icon: string; color: string }> = {
    'reply': { label: 'REPLY', icon: '💬', color: 'blue' },
    'mention': { label: 'MENTION', icon: '@', color: 'purple' },
    'likes': { label: 'LIKES', icon: '❤️', color: 'pink' },
    'like': { label: 'LIKES', icon: '❤️', color: 'pink' },
    'recasts': { label: 'RECAST', icon: '🔄', color: 'green' },
    'recast': { label: 'RECAST', icon: '🔄', color: 'green' },
    'follows': { label: 'FOLLOW', icon: '👤', color: 'gray' },
    'follow': { label: 'FOLLOW', icon: '👤', color: 'gray' },
  }
  return badges[type] || { label: type.toUpperCase(), icon: '📢', color: 'gray' }
}
