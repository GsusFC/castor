import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notificationEmitter } from '@/lib/notifications/events'

const NEYNAR_WEBHOOK_SECRET = process.env.NEYNAR_WEBHOOK_SECRET

/**
 * Verificar firma del webhook de Neynar
 */
function verifySignature(body: string, signature: string): boolean {
  if (!NEYNAR_WEBHOOK_SECRET) {
    console.warn('[Webhook] NEYNAR_WEBHOOK_SECRET not configured')
    return true // En desarrollo, aceptar sin verificar
  }
  
  const hmac = crypto.createHmac('sha512', NEYNAR_WEBHOOK_SECRET)
  const digest = hmac.update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

/**
 * POST /api/webhooks/neynar
 * Recibe eventos de Neynar en tiempo real
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-neynar-signature') || ''
    
    // Verificar firma
    if (!verifySignature(body, signature)) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const event = JSON.parse(body)
    const eventType = event.type
    
    console.log('[Webhook] Received:', eventType, JSON.stringify(event.data, null, 2).slice(0, 500))
    
    switch (eventType) {
      case 'cast.created':
        await handleCastCreated(event.data)
        break
        
      case 'reaction.created':
        await handleReactionCreated(event.data)
        break
        
      case 'reaction.deleted':
        await handleReactionDeleted(event.data)
        break
        
      case 'follow.created':
        await handleFollowCreated(event.data)
        break
        
      case 'follow.deleted':
        await handleFollowDeleted(event.data)
        break
        
      default:
        console.log('[Webhook] Unhandled event type:', eventType)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

/**
 * Obtener FIDs de nuestros usuarios registrados
 */
async function getOurUserFids(): Promise<number[]> {
  const allAccounts = await db.query.accounts.findMany()
  return allAccounts.map(a => a.fid)
}

/**
 * Nuevo cast (reply, mention, channel post)
 */
async function handleCastCreated(data: any) {
  const { cast } = data
  const ourFids = await getOurUserFids()
  
  // Si es reply a un cast de uno de nuestros usuarios
  if (cast.parent_author?.fid && ourFids.includes(cast.parent_author.fid)) {
    notificationEmitter.notify(cast.parent_author.fid, {
      type: 'reply',
      castHash: cast.hash,
      actor: {
        fid: cast.author.fid,
        username: cast.author.username,
        displayName: cast.author.display_name,
        pfpUrl: cast.author.pfp_url,
      },
      content: cast.text?.slice(0, 100),
      timestamp: new Date().toISOString(),
    })
  }
  
  // Si menciona a uno de nuestros usuarios
  const mentionedFids = cast.mentioned_profiles?.map((p: any) => p.fid) || []
  for (const fid of mentionedFids) {
    if (ourFids.includes(fid)) {
      notificationEmitter.notify(fid, {
        type: 'mention',
        castHash: cast.hash,
        actor: {
          fid: cast.author.fid,
          username: cast.author.username,
          displayName: cast.author.display_name,
          pfpUrl: cast.author.pfp_url,
        },
        content: cast.text?.slice(0, 100),
        timestamp: new Date().toISOString(),
      })
    }
  }
  
  console.log('[Webhook] New cast:', cast.hash, 'by', cast.author.username)
}

/**
 * Nueva reacción (like o recast)
 */
async function handleReactionCreated(data: any) {
  const { reaction } = data
  const ourFids = await getOurUserFids()
  
  // Si el cast es de uno de nuestros usuarios
  const targetAuthorFid = reaction.cast?.author?.fid
  if (targetAuthorFid && ourFids.includes(targetAuthorFid)) {
    notificationEmitter.notify(targetAuthorFid, {
      type: reaction.reaction_type === 'like' ? 'like' : 'recast',
      castHash: reaction.target_hash,
      actor: {
        fid: reaction.user.fid,
        username: reaction.user.username,
        displayName: reaction.user.display_name,
        pfpUrl: reaction.user.pfp_url,
      },
      timestamp: new Date().toISOString(),
    })
  }
  
  console.log('[Webhook] Reaction:', reaction.reaction_type, 'by', reaction.user?.username)
}

/**
 * Reacción eliminada
 */
async function handleReactionDeleted(data: any) {
  // No notificamos cuando quitan likes/recasts
  console.log('[Webhook] Reaction deleted')
}

/**
 * Nuevo follow
 */
async function handleFollowCreated(data: any) {
  const { follow } = data
  const ourFids = await getOurUserFids()
  
  // Si nos siguen a nosotros
  const followedFid = follow.following?.fid
  if (followedFid && ourFids.includes(followedFid)) {
    notificationEmitter.notify(followedFid, {
      type: 'follow',
      actor: {
        fid: follow.follower.fid,
        username: follow.follower.username,
        displayName: follow.follower.display_name,
        pfpUrl: follow.follower.pfp_url,
      },
      timestamp: new Date().toISOString(),
    })
  }
  
  console.log('[Webhook] Follow:', follow.follower?.username, '->', follow.following?.username)
}

/**
 * Unfollow
 */
async function handleFollowDeleted(data: any) {
  // No notificamos unfollows
  console.log('[Webhook] Unfollow')
}
