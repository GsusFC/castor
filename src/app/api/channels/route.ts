import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

interface Channel {
  id: string
  name: string
  image_url?: string
  description?: string
}

interface NeynarChannel {
  id: string
  name?: string
  image_url?: string
  description?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    let channels: Channel[] = []

    if (query && query.length >= 2) {
      // Buscar canales por nombre
      const response = await neynar.searchChannels({ q: query, limit: 20 })
      channels = response.channels
        .filter((channel): channel is typeof channel & { name: string } => !!channel.name)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          image_url: channel.image_url,
          description: channel.description,
        }))
    } else {
      // Obtener canales populares
      const response = await neynar.fetchTrendingChannels({ limit: 30 })
      channels = response.channels
        .map((item) => {
          const ch = (item as unknown as { channel: NeynarChannel }).channel
          return ch
        })
        .filter((ch): ch is NeynarChannel & { name: string } => !!ch?.name)
        .map((ch) => ({
          id: ch.id,
          name: ch.name,
          image_url: ch.image_url,
          description: ch.description,
        }))
    }

    const formattedChannels = channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      imageUrl: channel.image_url,
      description: channel.description,
    }))

    return NextResponse.json({ channels: formattedChannels })
  } catch (error) {
    console.error('[API] Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}
