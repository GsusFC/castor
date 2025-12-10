import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

/**
 * GET /api/social/[fid]/following
 * Obtener lista de usuarios que sigue
 */
export async function GET(
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

    const response = await neynar.fetchUserFollowing({
      fid: targetFid,
      limit,
      cursor,
    })

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

    return NextResponse.json({
      users: following,
      next: response.next,
    })
  } catch (error) {
    console.error('[Following] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 })
  }
}
