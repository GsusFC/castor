import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params

    // Check if it's a FID (numeric) or username
    const isFid = /^\d+$/.test(username)

    let user
    if (isFid) {
      const response = await neynar.fetchBulkUsers({ fids: [parseInt(username)] })
      user = response.users?.[0]
    } else {
      const response = await neynar.lookupUserByUsername({ username })
      user = response.user
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[User API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
