import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getSession } from '@/lib/auth'
import { db, typefullyConnections } from '@/lib/db'
import { encryptSecret } from '@/lib/crypto/secrets'
import { TypefullyApiError, TypefullyClient } from '@/lib/integrations/typefully'
import { getTypefullyConnectionForUser } from '@/lib/integrations/typefully-store'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await getTypefullyConnectionForUser(session.userId)
    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        apiKeyLabel: connection.apiKeyLabel,
        typefullyUserId: connection.typefullyUserId,
        typefullyUserName: connection.typefullyUserName,
        typefullyUserEmail: connection.typefullyUserEmail,
        lastValidatedAt: connection.lastValidatedAt,
        updatedAt: connection.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Typefully Connection] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as { apiKey?: string } | null
    const apiKey = body?.apiKey?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
    }

    const client = new TypefullyClient({ apiKey })
    const me = await client.getMe()
    const encryptedApiKey = encryptSecret(apiKey)
    const now = new Date()

    const existing = await getTypefullyConnectionForUser(session.userId)
    if (existing) {
      await db
        .update(typefullyConnections)
        .set({
          encryptedApiKey,
          apiKeyLabel: me.api_key_label || null,
          typefullyUserId: me.id,
          typefullyUserName: me.name,
          typefullyUserEmail: me.email,
          lastValidatedAt: now,
          updatedAt: now,
        })
        .where(eq(typefullyConnections.id, existing.id))
    } else {
      await db.insert(typefullyConnections).values({
        id: nanoid(),
        userId: session.userId,
        encryptedApiKey,
        apiKeyLabel: me.api_key_label || null,
        typefullyUserId: me.id,
        typefullyUserName: me.name,
        typefullyUserEmail: me.email,
        lastValidatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    return NextResponse.json({
      success: true,
      connected: true,
      me: {
        id: me.id,
        name: me.name,
        email: me.email,
        profileImageUrl: me.profile_image_url,
        apiKeyLabel: me.api_key_label,
      },
    })
  } catch (error) {
    if (error instanceof TypefullyApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      )
    }
    console.error('[Typefully Connection] POST error:', error)
    return NextResponse.json({ error: 'Failed to connect Typefully' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await getTypefullyConnectionForUser(session.userId)
    if (!existing) {
      return NextResponse.json({ success: true })
    }

    await db.delete(typefullyConnections).where(eq(typefullyConnections.id, existing.id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Typefully Connection] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Typefully' }, { status: 500 })
  }
}
