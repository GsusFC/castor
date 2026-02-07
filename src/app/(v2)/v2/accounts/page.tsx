import { db, accounts, accountMembers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { and, eq, exists, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { AccountsV2Client } from './AccountsV2Client'

export const dynamic = 'force-dynamic'

export default async function AccountsV2Page() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Fetch owned + member accounts (same query as v1)
  const accountsList = await db.query.accounts.findMany({
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

  const serializedAccounts = accountsList.map(account => ({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    pfpUrl: account.pfpUrl,
    type: account.type as 'personal' | 'business',
    signerStatus: account.signerStatus as 'pending' | 'approved' | 'revoked',
    isPremium: account.isPremium,
    ownerId: account.ownerId,
    owner: account.owner,
  }))

  return (
    <AccountsV2Client
      user={{
        userId: session.userId,
        username: session.username,
        displayName: session.displayName,
        pfpUrl: session.pfpUrl,
        role: session.role,
      }}
      accounts={serializedAccounts}
    />
  )
}
