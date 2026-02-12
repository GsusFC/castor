import { db, accounts as accountsTable, accountMembers, accountKnowledgeBase } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { and, eq, exists, or, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UnifiedDashboard } from './UnifiedDashboard'

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

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Obtener cuentas del usuario
  const accounts = await db.query.accounts.findMany({
    where: or(
      eq(accountsTable.ownerId, session.userId),
      exists(
        db
          .select({ id: accountMembers.id })
          .from(accountMembers)
          .where(and(eq(accountMembers.userId, session.userId), eq(accountMembers.accountId, accountsTable.id)))
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

  // Obtener IDs de las cuentas del usuario
  const accountIds = accounts.map(a => a.id)

  const [allCasts, allTemplates, knowledgeBases] = await Promise.all([
    // Obtener solo los casts de las cuentas del usuario
    accountIds.length > 0
      ? db.query.scheduledCasts.findMany({
          where: (casts, { inArray }) => inArray(casts.accountId, accountIds),
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
          orderBy: (casts, { desc }) => [desc(casts.scheduledAt)],
        })
      : Promise.resolve([]),
    // Obtener templates solo de las cuentas del usuario
    accountIds.length > 0
      ? db.select().from(templates).where(inArray(templates.accountId, accountIds))
      : Promise.resolve([]),
    // Obtener knowledge bases para verificar BrandVoice
    accountIds.length > 0
      ? db.query.accountKnowledgeBase.findMany({
          where: inArray(accountKnowledgeBase.accountId, accountIds),
          columns: {
            accountId: true,
            brandVoice: true,
          },
        })
      : Promise.resolve([]),
  ])

  // Map account -> hasBrandVoice
  const brandVoiceMap = new Map(
    knowledgeBases.map(kb => [kb.accountId, (kb.brandVoice?.trim().length || 0) > 0])
  )

  // Serializar datos para el cliente
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

  const serializedCasts = allCasts.map(cast => ({
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
    account: cast.account ? {
      id: cast.account.id,
      username: cast.account.username,
      displayName: cast.account.displayName,
      pfpUrl: cast.account.pfpUrl,
    } : null,
    createdBy: cast.createdBy,
    media: cast.media?.map(m => ({
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
    <UnifiedDashboard
      accounts={serializedAccounts}
      casts={serializedCasts}
      templates={serializedTemplates}
      currentUserId={session.userId}
      userFid={session.fid}
      isAdmin={session.role === 'admin'}
    />
  )
}
