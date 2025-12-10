import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, castAnalytics } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { publishCast } from '@/lib/farcaster/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accountId, content, channelId, embeds, parentHash } = body
    
    console.log('[Publish API] Request:', {
      accountId,
      content: content?.slice(0, 50),
      channelId,
      embeds,
      parentHash,
    })

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      )
    }

    // Obtener cuenta con signer (usar accountId específico o el primer account aprobado)
    let account
    if (accountId) {
      account = await db.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
      })
    } else {
      // Buscar el primer account aprobado del usuario
      const userAccounts = await db.query.accounts.findMany({
        where: eq(accounts.ownerId, session.userId),
      })
      account = userAccounts.find(a => a.signerStatus === 'approved')
    }

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!account.signerUuid || account.signerStatus !== 'approved') {
      return NextResponse.json(
        { error: 'Account does not have an approved signer' },
        { status: 400 }
      )
    }

    // Preparar embeds - solo extraer URLs válidas
    const embedUrls = embeds
      ?.filter((e: { url?: string }) => e.url && e.url.trim())
      .map((e: { url: string }) => ({ url: e.url })) || []

    console.log('[Publish API] Embeds to send:', embedUrls)

    // Publicar cast
    const result = await publishCast(account.signerUuid, content, {
      embeds: embedUrls.length > 0 ? embedUrls : undefined,
      channelId: channelId || undefined,
      parentHash: parentHash || undefined,
    })
    
    console.log('[Publish API] Result:', result)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Registrar en analytics (no bloquea la respuesta)
    if (result.hash) {
      db.insert(castAnalytics).values({
        id: crypto.randomUUID(),
        castHash: result.hash,
        accountId: account.id,
        content: content.slice(0, 500),
        likes: 0,
        recasts: 0,
        replies: 0,
        publishedAt: new Date(),
      }).catch(err => console.error('[Analytics] Track error:', err))
    }

    return NextResponse.json({
      success: true,
      hash: result.hash,
      cast: result.cast,
    })
  } catch (error) {
    console.error('[Publish API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to publish cast' },
      { status: 500 }
    )
  }
}
