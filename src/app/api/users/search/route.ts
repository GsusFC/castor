import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

/**
 * GET /api/users/search?q=username
 * Busca usuarios en Farcaster para autocompletado de mentions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 1) {
      return NextResponse.json({ users: [] })
    }

    const response = await neynar.searchUser({
      q: query,
      limit: 10,
    })

    const users = response.result.users.map(user => ({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[API] Error searching users:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }
}
