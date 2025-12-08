import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { publishCast } from '@/lib/farcaster/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { accountId, content, channelId, embeds, parentHash } = await request.json()

    if (!accountId || !content?.trim()) {
      return NextResponse.json(
        { error: 'accountId and content are required' },
        { status: 400 }
      )
    }

    // Obtener cuenta con signer
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!account.signerUuid || account.signerStatus !== 'approved') {
      return NextResponse.json(
        { error: 'Account does not have an approved signer' },
        { status: 400 }
      )
    }

    // Preparar embeds
    const embedUrls = embeds?.map((e: { url: string }) => ({ url: e.url })) || []

    // Publicar cast
    const result = await publishCast(account.signerUuid, content, {
      embeds: embedUrls.length > 0 ? embedUrls : undefined,
      channelId: channelId || undefined,
      parentHash: parentHash || undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
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
