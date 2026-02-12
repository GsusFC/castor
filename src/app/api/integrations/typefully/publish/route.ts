import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, typefullySocialSets } from '@/lib/db'
import { getTypefullyClientForUser, getTypefullyConnectionForUser } from '@/lib/integrations/typefully-store'
import { TypefullyApiError } from '@/lib/integrations/typefully'

const bodySchema = z.object({
  accountId: z.string().min(1),
  socialSetId: z.number().int().positive().optional(),
  networks: z.array(z.enum(['x', 'linkedin'])).min(1),
  posts: z.array(
    z.object({
      text: z.string().min(1),
    })
  ).min(1),
  publishAt: z.union([z.literal('now'), z.string().datetime()]).optional(),
})

const platformFromNetwork = (network: 'x' | 'linkedin') => network

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const { accountId, socialSetId, networks, posts, publishAt } = parsed.data

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { id: true, ownerId: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, session.userId)),
      columns: { id: true },
    })

    if (account.ownerId !== session.userId && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const connection = await getTypefullyConnectionForUser(session.userId)
    if (!connection) {
      return NextResponse.json({ error: 'Typefully is not connected' }, { status: 400 })
    }

    const linkedSocialSet = socialSetId
      ? await db.query.typefullySocialSets.findFirst({
          where: and(
            eq(typefullySocialSets.connectionId, connection.id),
            eq(typefullySocialSets.socialSetId, socialSetId)
          ),
        })
      : await db.query.typefullySocialSets.findFirst({
          where: and(
            eq(typefullySocialSets.connectionId, connection.id),
            eq(typefullySocialSets.linkedAccountId, accountId)
          ),
        })

    if (!linkedSocialSet) {
      return NextResponse.json(
        { error: 'No Typefully social set linked to this Castor account' },
        { status: 400 }
      )
    }

    const client = await getTypefullyClientForUser(session.userId)
    if (!client) {
      return NextResponse.json({ error: 'Typefully connection unavailable' }, { status: 500 })
    }

    const detail = await client.getSocialSet(linkedSocialSet.socialSetId)
    const hasValue = (value: string | null | undefined) => Boolean(value?.trim())
    const unavailable = networks.filter((network) => {
      const platform = detail.platforms[platformFromNetwork(network)]
      return !(
        hasValue(platform?.username) ||
        hasValue(platform?.profile_url) ||
        hasValue(platform?.name) ||
        hasValue(platform?.profile_image_url)
      )
    })
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `Networks not connected in Typefully: ${unavailable.join(', ')}` },
        { status: 400 }
      )
    }

    const platforms = {
      x: { enabled: false },
      linkedin: { enabled: false },
      mastodon: { enabled: false },
      threads: { enabled: false },
      bluesky: { enabled: false },
    } as {
      x: { enabled: boolean; posts?: { text: string }[] }
      linkedin: { enabled: boolean; posts?: { text: string }[] }
      mastodon: { enabled: boolean }
      threads: { enabled: boolean }
      bluesky: { enabled: boolean }
    }

    if (networks.includes('x')) {
      platforms.x = { enabled: true, posts }
    }
    if (networks.includes('linkedin')) {
      platforms.linkedin = { enabled: true, posts }
    }

    const draft = await client.createDraft(linkedSocialSet.socialSetId, {
      platforms,
      ...(publishAt ? { publish_at: publishAt } : {}),
    })

    return NextResponse.json({
      success: true,
      socialSetId: linkedSocialSet.socialSetId,
      networks,
      draft,
    })
  } catch (error) {
    if (error instanceof TypefullyApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      )
    }
    console.error('[Typefully Publish] POST error:', error)
    return NextResponse.json({ error: 'Failed to publish via Typefully' }, { status: 500 })
  }
}
