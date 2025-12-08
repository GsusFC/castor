import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hash = searchParams.get('hash')
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10)

    if (!hash) {
      return NextResponse.json({ error: 'hash is required' }, { status: 400 })
    }

    const response = await neynar.lookupCastConversation({
      identifier: hash,
      type: 'hash',
      replyDepth: 1,
      limit,
    })

    // Extraer solo los replies directos
    const replies = response.conversation?.cast?.direct_replies || []

    return NextResponse.json({
      replies: replies.map((reply: any) => ({
        hash: reply.hash,
        text: reply.text,
        timestamp: reply.timestamp,
        author: {
          fid: reply.author?.fid,
          username: reply.author?.username,
          display_name: reply.author?.display_name,
          pfp_url: reply.author?.pfp_url,
        },
        reactions: {
          likes_count: reply.reactions?.likes_count || 0,
          recasts_count: reply.reactions?.recasts_count || 0,
        },
      })),
    })
  } catch (error) {
    console.error('[Replies API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    )
  }
}
