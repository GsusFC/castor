import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

export async function GET(
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
    const userResponse = await neynar.lookupUserByUsername({ username })
    if (!userResponse.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const fid = userResponse.user.fid

    let result: { casts: any[]; next?: { cursor?: string } }

    if (type === 'casts') {
      // User's casts (excluding replies)
      const response = await neynar.fetchFeed({
        feedType: 'filter',
        filterType: 'fids',
        fids: String(fid),
        limit,
        cursor,
      })
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'replies') {
      // User's replies
      const response = await neynar.fetchRepliesAndRecastsForUser({
        fid,
        filter: 'replies',
        limit,
        cursor,
      })
      result = {
        casts: response.casts || [],
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else if (type === 'likes') {
      // User's likes
      const response = await neynar.fetchUserReactions({
        fid,
        type: 'likes',
        limit,
        cursor,
      })
      result = {
        casts: (response.reactions || []).map((r: any) => r.cast).filter(Boolean),
        next: { cursor: response.next?.cursor ?? undefined },
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[User Casts API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch casts' },
      { status: 500 }
    )
  }
}
