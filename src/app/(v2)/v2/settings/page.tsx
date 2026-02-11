import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq, exists, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { SettingsV2Client } from './SettingsV2Client'

export const dynamic = 'force-dynamic'

export default async function SettingsV2Page() {
  const session = await getSession()
  if (!session) redirect('/login')

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
    columns: {
      id: true,
      username: true,
      displayName: true,
      type: true,
      voiceMode: true,
    },
    orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
  })

  return (
    <SettingsV2Client
      user={{
        username: session.username,
        displayName: session.displayName,
        pfpUrl: session.pfpUrl,
      }}
      accounts={accountsList.map((account) => ({
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        type: account.type as 'personal' | 'business',
        voiceMode: account.voiceMode as 'auto' | 'brand' | 'personal',
      }))}
    />
  )
}
