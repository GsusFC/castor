import { NextResponse } from 'next/server'
import { and, eq, exists, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, typefullySocialSets } from '@/lib/db'
import { getTypefullyClientForUser, getTypefullyConnectionForUser } from '@/lib/integrations/typefully-store'
import { TypefullyApiError, type TypefullyPlatformAccount } from '@/lib/integrations/typefully'

const MAX_PAGES = 10
const PAGE_LIMIT = 50
const PLATFORM_KEYS = ['x', 'linkedin', 'mastodon', 'threads', 'bluesky'] as const

const hasValue = (value: string | null | undefined) => Boolean(value?.trim())

const isPlatformConnected = (platform: TypefullyPlatformAccount | null | undefined) =>
  Boolean(
    hasValue(platform?.username) ||
      hasValue(platform?.profile_url) ||
      hasValue(platform?.name) ||
      hasValue(platform?.profile_image_url)
  )

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await getTypefullyConnectionForUser(session.userId)
    if (!connection) {
      return NextResponse.json({ connected: false, socialSets: [], accounts: [] })
    }

    const client = await getTypefullyClientForUser(session.userId)
    if (!client) {
      return NextResponse.json({ error: 'Typefully connection not available' }, { status: 500 })
    }

    const remoteSets: Awaited<ReturnType<typeof client.listSocialSets>>['results'] = []
    let offset = 0

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await client.listSocialSets(PAGE_LIMIT, offset)
      remoteSets.push(...result.results)
      offset += result.results.length
      if (!result.next || result.results.length === 0) break
    }

    const now = new Date()
    for (const set of remoteSets) {
      const existing = await db.query.typefullySocialSets.findFirst({
        where: and(
          eq(typefullySocialSets.connectionId, connection.id),
          eq(typefullySocialSets.socialSetId, set.id)
        ),
      })

      if (existing) {
        await db
          .update(typefullySocialSets)
          .set({
            username: set.username,
            name: set.name,
            profileImageUrl: set.profile_image_url,
            teamId: set.team?.id || null,
            teamName: set.team?.name || null,
            lastSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(typefullySocialSets.id, existing.id))
      } else {
        await db.insert(typefullySocialSets).values({
          id: nanoid(),
          connectionId: connection.id,
          socialSetId: set.id,
          username: set.username,
          name: set.name,
          profileImageUrl: set.profile_image_url,
          teamId: set.team?.id || null,
          teamName: set.team?.name || null,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    const platformDetails = await Promise.allSettled(
      remoteSets.map(async (set) => {
        const detail = await client.getSocialSet(set.id)
        const connectedPlatforms = PLATFORM_KEYS.filter((key) =>
          isPlatformConnected(detail.platforms?.[key])
        )
        return { socialSetId: set.id, connectedPlatforms }
      })
    )

    const connectedPlatformsBySet = new Map<number, string[]>()
    for (const result of platformDetails) {
      if (result.status === 'fulfilled') {
        connectedPlatformsBySet.set(result.value.socialSetId, result.value.connectedPlatforms)
      }
    }

    const linkedSets = await db.query.typefullySocialSets.findMany({
      where: eq(typefullySocialSets.connectionId, connection.id),
      with: {
        linkedAccount: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            pfpUrl: true,
          },
        },
      },
      orderBy: (sets, { asc }) => [asc(sets.name)],
    })

    const accessibleAccounts = await db.query.accounts.findMany({
      where: or(
        eq(accounts.ownerId, session.userId),
        exists(
          db
            .select({ id: accountMembers.id })
            .from(accountMembers)
            .where(
              and(
                eq(accountMembers.userId, session.userId),
                eq(accountMembers.accountId, accounts.id)
              )
            )
        )
      ),
      columns: {
        id: true,
        username: true,
        displayName: true,
        pfpUrl: true,
        type: true,
      },
      orderBy: (accountRows, { asc }) => [asc(accountRows.username)],
    })

    return NextResponse.json({
      connected: true,
      socialSets: linkedSets.map((set) => ({
        id: set.id,
        socialSetId: set.socialSetId,
        username: set.username,
        name: set.name,
        profileImageUrl: set.profileImageUrl,
        teamId: set.teamId,
        teamName: set.teamName,
        connectedPlatforms: connectedPlatformsBySet.get(set.socialSetId) || [],
        linkedAccountId: set.linkedAccountId,
        linkedAccount: set.linkedAccount,
        lastSyncedAt: set.lastSyncedAt,
      })),
      accounts: accessibleAccounts,
      syncedCount: remoteSets.length,
    })
  } catch (error) {
    if (error instanceof TypefullyApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      )
    }
    console.error('[Typefully Social Sets] GET error:', error)
    return NextResponse.json({ error: 'Failed to load Typefully social sets' }, { status: 500 })
  }
}
