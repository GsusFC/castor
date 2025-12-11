import { db, accounts as accountsTable } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, or, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UnifiedDashboard } from './UnifiedDashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Obtener cuentas del usuario
  const accounts = await db.query.accounts.findMany({
    where: or(
      eq(accountsTable.ownerId, session.userId),
      eq(accountsTable.isShared, true)
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

  // Obtener solo los casts de las cuentas del usuario
  const allCasts = accountIds.length > 0 
    ? await db.query.scheduledCasts.findMany({
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
    : []

  // Obtener templates solo de las cuentas del usuario
  const allTemplates = accountIds.length > 0
    ? await db.select().from(templates).where(inArray(templates.accountId, accountIds))
    : []

  // Serializar datos para el cliente
  const serializedAccounts = accounts.map(account => ({
    id: account.id,
    fid: account.fid,
    username: account.username,
    displayName: account.displayName,
    pfpUrl: account.pfpUrl,
    signerStatus: account.signerStatus,
    type: account.type,
    isPremium: account.isPremium,
    isShared: account.isShared,
    ownerId: account.ownerId,
    owner: account.owner,
  }))

  const serializedCasts = allCasts.map(cast => ({
    id: cast.id,
    content: cast.content,
    status: cast.status,
    scheduledAt: cast.scheduledAt.toISOString(),
    publishedAt: cast.publishedAt?.toISOString() || null,
    castHash: cast.castHash,
    channelId: cast.channelId,
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

