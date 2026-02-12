import { db, accounts as accountsTable, accountMembers, accountKnowledgeBase } from '@/lib/db'
import { templates, scheduledCasts } from '@/lib/db/schema'
import { and, eq, exists, or, inArray, gte, lte, desc, asc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { StudioV2Client } from './StudioV2Client'

export const dynamic = 'force-dynamic'

const parsePublishTargets = (value: string | null): Array<'farcaster' | 'x' | 'linkedin'> | undefined => {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return undefined
    const targets = parsed.filter(
      (item): item is 'farcaster' | 'x' | 'linkedin' =>
        item === 'farcaster' || item === 'x' || item === 'linkedin'
    )
    return targets.length > 0 ? targets : undefined
  } catch {
    return undefined
  }
}

export default async function StudioV2Page() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Fetch user accounts (owned + member access)
  const accounts = await db.query.accounts.findMany({
    where: or(
      eq(accountsTable.ownerId, session.userId),
      exists(
        db
          .select({ id: accountMembers.id })
          .from(accountMembers)
          .where(
            and(
              eq(accountMembers.userId, session.userId),
              eq(accountMembers.accountId, accountsTable.id)
            )
          )
      )
    ),
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          pfpUrl: true,
        },
      },
    },
    orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
  })

  const accountIds = accounts.map(a => a.id)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const monthStatuses: Array<typeof scheduledCasts.$inferSelect.status> = ['scheduled', 'draft', 'retrying', 'failed', 'publishing']
  const queueStatuses: Array<typeof scheduledCasts.$inferSelect.status> = ['scheduled', 'draft', 'retrying']

  const [calendarWindowCasts, upcomingCasts, recentPublishedCasts, allTemplates, knowledgeBases] = await Promise.all([
    accountIds.length > 0
      ? db.query.scheduledCasts.findMany({
          where: and(
            inArray(scheduledCasts.accountId, accountIds),
            inArray(scheduledCasts.status, monthStatuses),
            gte(scheduledCasts.scheduledAt, monthStart),
            lte(scheduledCasts.scheduledAt, monthEnd)
          ),
          limit: 120,
          orderBy: [asc(scheduledCasts.scheduledAt)],
          with: {
            account: true,
            media: true,
            createdBy: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                pfpUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    accountIds.length > 0
      ? db.query.scheduledCasts.findMany({
          where: and(
            inArray(scheduledCasts.accountId, accountIds),
            inArray(scheduledCasts.status, queueStatuses),
            gte(scheduledCasts.scheduledAt, now)
          ),
          limit: 80,
          orderBy: [asc(scheduledCasts.scheduledAt)],
          with: {
            account: true,
            media: true,
            createdBy: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                pfpUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    accountIds.length > 0
      ? db.query.scheduledCasts.findMany({
          where: and(
            inArray(scheduledCasts.accountId, accountIds),
            eq(scheduledCasts.status, 'published')
          ),
          limit: 60,
          orderBy: [desc(scheduledCasts.publishedAt)],
          with: {
            account: true,
            media: true,
            createdBy: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                pfpUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    accountIds.length > 0
      ? db.select().from(templates).where(inArray(templates.accountId, accountIds))
      : Promise.resolve([]),
    accountIds.length > 0
      ? db.query.accountKnowledgeBase.findMany({
          where: inArray(accountKnowledgeBase.accountId, accountIds),
          columns: { accountId: true, brandVoice: true },
        })
      : Promise.resolve([]),
  ])

  const brandVoiceMap = new Map(
    knowledgeBases.map(kb => [kb.accountId, (kb.brandVoice?.trim().length || 0) > 0])
  )

  // Serialize for client
  const serializedAccounts = accounts.map(account => ({
    id: account.id,
    fid: account.fid,
    username: account.username,
    displayName: account.displayName,
    pfpUrl: account.pfpUrl,
    signerStatus: account.signerStatus,
    type: account.type,
    voiceMode: account.voiceMode,
    isPremium: account.isPremium,
    ownerId: account.ownerId,
    owner: account.owner,
    hasBrandVoice: brandVoiceMap.get(account.id) ?? false,
  }))

  const mergedCasts = [...calendarWindowCasts, ...upcomingCasts, ...recentPublishedCasts]
  const uniqueCasts = Array.from(new Map(mergedCasts.map(cast => [cast.id, cast])).values())

  const serializedCasts = uniqueCasts.map(cast => ({
    id: cast.id,
    content: cast.content,
    status: cast.status,
    network: cast.network ?? undefined,
    publishTargets: parsePublishTargets(cast.publishTargets),
    scheduledAt: cast.scheduledAt.toISOString(),
    publishedAt: cast.publishedAt?.toISOString() || null,
    castHash: cast.castHash,
    channelId: cast.channelId,
    errorMessage: cast.errorMessage,
    retryCount: cast.retryCount ?? 0,
    accountId: cast.accountId,
    account: cast.account
      ? {
          id: cast.account.id,
          username: cast.account.username,
          displayName: cast.account.displayName,
          pfpUrl: cast.account.pfpUrl,
        }
      : null,
    createdBy: cast.createdBy,
    media:
      cast.media?.map(m => ({
        id: m.id,
        url: m.url,
        type: m.type,
        thumbnailUrl: m.thumbnailUrl,
        cloudflareId: m.cloudflareId,
        livepeerAssetId: m.livepeerAssetId,
        livepeerPlaybackId: m.livepeerPlaybackId,
        videoStatus: m.videoStatus,
        mp4Url: m.mp4Url,
        hlsUrl: m.hlsUrl,
      })) || [],
  }))

  const serializedTemplates = allTemplates.map(t => ({
    id: t.id,
    accountId: t.accountId,
    name: t.name,
    content: t.content,
    channelId: t.channelId,
  }))

  return (
    <StudioV2Client
      user={{
        userId: session.userId,
        fid: session.fid,
        username: session.username,
        displayName: session.displayName,
        pfpUrl: session.pfpUrl,
        role: session.role,
      }}
      accounts={serializedAccounts}
      casts={serializedCasts}
      templates={serializedTemplates}
    />
  )
}
