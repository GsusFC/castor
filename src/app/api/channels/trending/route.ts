import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const response = await neynar.fetchTrendingChannels({
      limit,
    })

    const channels = response.channels?.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      image_url: channel.image_url,
      follower_count: channel.follower_count,
      description: channel.description,
    })) || []

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Error fetching trending channels:', error)
    return NextResponse.json(
      { error: 'Error fetching channels' },
      { status: 500 }
    )
  }
}
