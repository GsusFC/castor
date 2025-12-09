import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.fid) {
      return NextResponse.json({ channels: [] })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    // Paginar para obtener todos los canales
    const allMemberships: any[] = []
    let cursor: string | undefined
    const pageSize = 100 // Máximo por página de Neynar

    do {
      const response = await neynar.fetchUserChannelMemberships({
        fid: session.fid,
        limit: pageSize,
        cursor,
      }) as any

      const memberships = response.members || response.channels || []
      allMemberships.push(...memberships)
      
      cursor = response.next?.cursor
      
      // Parar si ya tenemos suficientes o no hay más
      if (allMemberships.length >= limit || !cursor) break
    } while (cursor)

    const channels = allMemberships.slice(0, limit).map((membership: any) => ({
      id: membership.channel?.id || membership.id,
      name: membership.channel?.name || membership.name,
      image_url: membership.channel?.image_url || membership.image_url,
      follower_count: membership.channel?.follower_count || membership.follower_count,
      description: membership.channel?.description || membership.description,
    }))

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Error fetching user channels:', error)
    return NextResponse.json(
      { error: 'Error fetching channels' },
      { status: 500 }
    )
  }
}
