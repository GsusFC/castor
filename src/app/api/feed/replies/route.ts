import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

// Filtro Priority Mode para replies
function filterSpamReplies(replies: any[]): any[] {
  return replies.filter((reply) => {
    const author = reply.author
    if (!author) return false
    
    const followerCount = author.follower_count ?? 0
    const isPro = author.pro?.status === 'subscribed'
    
    if (author.power_badge) return true
    if (isPro) return true
    if (!author.username || author.username.startsWith('!')) return false
    if (followerCount >= 100) return true
    if (followerCount >= 50) return true
    
    return false
  })
}

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

    // Extraer solo los replies directos y filtrar spam
    const rawReplies = response.conversation?.cast?.direct_replies || []
    const replies = filterSpamReplies(rawReplies)

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
