import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'
import { getClientIP, withRateLimit } from '@/lib/rate-limit'
import { retryExternalApi, withCircuitBreaker } from '@/lib/retry'

const callNeynar = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  return withCircuitBreaker(key, () => retryExternalApi(fn, key))
}

async function handleGET(request: NextRequest) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    
    const q = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'all' // all, casts, users, channels
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

    if (!q || q.length < 2) {
      return NextResponse.json({ casts: [], users: [], channels: [] })
    }

    const results: {
      casts: any[]
      users: any[]
      channels: any[]
    } = { casts: [], users: [], channels: [] }

    const usernameCandidate = q.startsWith('@') ? q.slice(1) : q
    const isLikelyUsername = /^[a-z0-9_]{2,}$/i.test(usernameCandidate)

    // Búsqueda paralela según el tipo
    const promises: Promise<void>[] = []

    if (type === 'all' || type === 'casts') {
      promises.push(
        callNeynar('neynar:search:casts', () =>
          neynar.searchCasts({
            q,
            limit,
            priorityMode: true, // Solo power badge users para evitar spam
            viewerFid: session?.fid,
          })
        ).then((res) => {
          results.casts = (res.result?.casts || []).map((cast: any) => ({
            hash: cast.hash,
            text: cast.text,
            timestamp: cast.timestamp,
            author: {
              fid: cast.author?.fid,
              username: cast.author?.username,
              display_name: cast.author?.display_name,
              pfp_url: cast.author?.pfp_url,
            },
            reactions: cast.reactions,
            replies: cast.replies,
          }))
        }).catch((error) => {
          console.error('[Search API] searchCasts failed:', error)
        })
      )
    }

    if (type === 'all' || type === 'users') {
      promises.push(
        callNeynar('neynar:search:users', () =>
          neynar.searchUser({
            q,
            limit,
            viewerFid: session?.fid,
          })
        ).then((res) => {
          results.users = (res.result?.users || []).map((user: any) => ({
            fid: user.fid,
            username: user.username,
            display_name: user.display_name,
            pfp_url: user.pfp_url,
            follower_count: user.follower_count,
            bio: user.profile?.bio?.text,
            power_badge: user.power_badge,
          }))
        }).catch((error) => {
          console.error('[Search API] searchUser failed:', error)
        })
      )
    }

    if (type === 'all' || type === 'channels') {
      promises.push(
        callNeynar('neynar:search:channels', () =>
          neynar.searchChannels({
            q,
            limit,
          })
        ).then((res) => {
          results.channels = (res.channels || []).map((channel: any) => ({
            id: channel.id,
            name: channel.name,
            description: channel.description,
            image_url: channel.image_url,
            follower_count: channel.follower_count,
          }))
        }).catch((error) => {
          console.error('[Search API] searchChannels failed:', error)
        })
      )
    }

    if ((type === 'all' || type === 'users') && isLikelyUsername) {
      promises.push(
        callNeynar('neynar:search:lookup-user', () =>
          neynar.lookupUserByUsername({
            username: usernameCandidate,
            viewerFid: session?.fid,
          })
        ).then((res) => {
          const user = res.user
          if (!user) return

          const alreadyPresent = results.users.some((u) => u?.fid === user.fid || u?.username === user.username)
          if (alreadyPresent) return

          results.users.unshift({
            fid: user.fid,
            username: user.username,
            display_name: user.display_name,
            pfp_url: user.pfp_url,
            follower_count: user.follower_count,
            bio: user.profile?.bio?.text,
            power_badge: user.power_badge,
          })
        }).catch((error) => {
          console.error('[Search API] lookupUserByUsername failed:', error)
        })
      )
    }

    await Promise.all(promises)

    const response = NextResponse.json(results)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Circuit breaker open')) {
      return NextResponse.json(
        { error: 'Upstream unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        { status: 503 }
      )
    }
    console.error('[Search API] Error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}

export const GET = withRateLimit('api', (req) => {
  const url = new URL(req.url)
  return `${getClientIP(req)}:${url.pathname}`
})(handleGET)
