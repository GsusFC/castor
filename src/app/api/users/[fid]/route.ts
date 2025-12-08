import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params
    const fidNum = parseInt(fid)

    if (isNaN(fidNum)) {
      return NextResponse.json({ error: 'Invalid FID' }, { status: 400 })
    }

    const response = await neynar.fetchBulkUsers({ fids: [fidNum] })
    const user = response.users?.[0]

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      bio: user.profile?.bio?.text,
      follower_count: user.follower_count || 0,
      following_count: user.following_count || 0,
      verified_addresses: user.verified_addresses,
    })
  } catch (error) {
    console.error('[User API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
