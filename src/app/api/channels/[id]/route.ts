import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession()
    const viewerFid = session?.fid

    const response = await neynar.lookupChannel({ id, viewerFid })

    if (!response.channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Type assertion para acceder a campos adicionales
    const channel = response.channel as typeof response.channel & {
      header_image_url?: string
      member_count?: number
      viewer_context?: { following: boolean }
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error('[API] Error looking up channel:', error)
    return NextResponse.json(
      { error: 'Failed to lookup channel' },
      { status: 500 }
    )
  }
}
