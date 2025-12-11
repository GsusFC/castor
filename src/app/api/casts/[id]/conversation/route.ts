import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

/**
 * GET /api/casts/[id]/conversation
 * Obtiene un cast con su contexto: parent (si existe) y replies
 */

interface CastAuthor {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  power_badge?: boolean
}

interface CastEmbed {
  url?: string
  type?: string
  cast?: unknown
}

interface FormattedCast {
  hash: string
  text: string
  author: CastAuthor
  timestamp: string
  embeds?: CastEmbed[]
  reactions?: {
    likes_count: number
    recasts_count: number
  }
  replies?: {
    count: number
  }
  parent_hash?: string
  parent_url?: string
  channel?: {
    id: string
    name: string
    image_url?: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCast(cast: any): FormattedCast {
  return {
    hash: cast.hash,
    text: cast.text,
    author: {
      fid: cast.author.fid,
      username: cast.author.username,
      display_name: cast.author.display_name,
      pfp_url: cast.author.pfp_url,
      power_badge: cast.author.power_badge,
    },
    timestamp: cast.timestamp,
    embeds: cast.embeds,
    reactions: cast.reactions ? {
      likes_count: cast.reactions.likes_count || cast.reactions.likes?.length || 0,
      recasts_count: cast.reactions.recasts_count || cast.reactions.recasts?.length || 0,
    } : undefined,
    replies: cast.replies ? {
      count: cast.replies.count || 0,
    } : undefined,
    parent_hash: cast.parent_hash,
    parent_url: cast.parent_url,
    channel: cast.channel ? {
      id: cast.channel.id,
      name: cast.channel.name,
      image_url: cast.channel.image_url,
    } : undefined,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hash } = await params
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '25')

    if (!hash) {
      return NextResponse.json(
        { error: 'hash is required' },
        { status: 400 }
      )
    }

    // 1. Obtener el cast principal
    const castResponse = await neynar.lookupCastByHashOrWarpcastUrl({
      identifier: hash,
      type: 'hash',
    })

    if (!castResponse.cast) {
      return NextResponse.json(
        { error: 'Cast not found' },
        { status: 404 }
      )
    }

    const mainCast = castResponse.cast

    // 2. Obtener toda la cadena de ancestors (thread completo hasta root)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ancestors: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentCast: any = mainCast
    
    while (currentCast?.parent_hash) {
      try {
        const parentResponse = await neynar.lookupCastByHashOrWarpcastUrl({
          identifier: currentCast.parent_hash,
          type: 'hash',
        })
        if (parentResponse.cast) {
          ancestors.unshift(parentResponse.cast) // Añadir al principio
          currentCast = parentResponse.cast
        } else {
          break
        }
      } catch {
        console.log('[Conversation] Ancestor cast not found or deleted')
        break
      }
    }

    // 3. Obtener replies usando la API de Neynar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let replies: any[] = []
    let nextCursor: string | null = null

    try {
      const repliesUrl = new URL('https://api.neynar.com/v2/farcaster/cast/conversation')
      repliesUrl.searchParams.set('identifier', hash)
      repliesUrl.searchParams.set('type', 'hash')
      repliesUrl.searchParams.set('reply_depth', '1')
      repliesUrl.searchParams.set('limit', limit.toString())
      if (cursor) {
        repliesUrl.searchParams.set('cursor', cursor)
      }

      const repliesResponse = await fetch(repliesUrl.toString(), {
        headers: {
          'accept': 'application/json',
          'x-api-key': process.env.NEYNAR_API_KEY || '',
        },
      })

      if (repliesResponse.ok) {
        const repliesData = await repliesResponse.json()
        if (repliesData.conversation?.cast?.direct_replies) {
          replies = repliesData.conversation.cast.direct_replies
        }
        nextCursor = repliesData.next?.cursor || null
      }
    } catch (error) {
      console.error('[Conversation] Error fetching replies:', error)
    }

    // Thread completo: ancestors + mainCast (en orden cronológico)
    const thread = [...ancestors.map(formatCast), formatCast(mainCast)]

    return NextResponse.json({
      thread,
      targetHash: hash, // El cast que originó la vista
      replies: {
        casts: replies.map(formatCast),
        cursor: nextCursor,
        hasMore: !!nextCursor,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}
