import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
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

    // Búsqueda paralela según el tipo
    const promises: Promise<void>[] = []

    if (type === 'all' || type === 'casts') {
      promises.push(
        neynar.searchCasts({
          q,
          limit,
          priorityMode: true, // Solo power badge users para evitar spam
          viewerFid: session?.fid,
        }).then((res) => {
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
        }).catch(() => {})
      )
    }

    if (type === 'all' || type === 'users') {
      promises.push(
        neynar.searchUser({
          q,
          limit,
          viewerFid: session?.fid,
        }).then((res) => {
          results.users = (res.result?.users || []).map((user: any) => ({
            fid: user.fid,
            username: user.username,
            display_name: user.display_name,
            pfp_url: user.pfp_url,
            follower_count: user.follower_count,
            bio: user.profile?.bio?.text,
            power_badge: user.power_badge,
          }))
        }).catch(() => {})
      )
    }

    if (type === 'all' || type === 'channels') {
      promises.push(
        neynar.searchChannels({
          q,
          limit,
        }).then((res) => {
          results.channels = (res.channels || []).map((channel: any) => ({
            id: channel.id,
            name: channel.name,
            description: channel.description,
            image_url: channel.image_url,
            follower_count: channel.follower_count,
          }))
        }).catch(() => {})
      )
    }

    await Promise.all(promises)

    return NextResponse.json(results)
  } catch (error) {
    console.error('[Search API] Error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
