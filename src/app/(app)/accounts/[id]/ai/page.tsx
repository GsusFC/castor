import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db, accounts, accountKnowledgeBase, accountDocuments, accountMembers, userStyleProfiles } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { AccountTabs } from './AccountTabs'
import { AccountHeader } from './AccountHeader'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AccountContextPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  const [account, membership] = await Promise.all([
    db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    }),
    db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, id),
        eq(accountMembers.userId, session.userId)
      ),
    }),
  ])

  if (!account) {
    notFound()
  }

  // Verificar permisos: owner o miembro con canEditContext
  const isOwner = account.ownerId === session.userId

  const canEdit = isOwner || membership?.canEditContext || membership?.role === 'admin'
  const canView = isOwner || !!membership

  if (!canView) {
    redirect('/accounts')
  }

  const canViewMembers = isOwner || membership?.role === 'admin'

  const [styleProfile, knowledgeBase, documents, members] = await Promise.all([
    account.ownerId
      ? db.query.userStyleProfiles.findFirst({
          where: eq(userStyleProfiles.userId, account.ownerId),
        })
      : Promise.resolve(null),
    db.query.accountKnowledgeBase.findFirst({
      where: eq(accountKnowledgeBase.accountId, id),
    }),
    db.query.accountDocuments.findMany({
      where: eq(accountDocuments.accountId, id),
      orderBy: (docs, { desc }) => [desc(docs.addedAt)],
    }),
    canViewMembers
      ? db.query.accountMembers.findMany({
          where: eq(accountMembers.accountId, id),
          with: {
            user: {
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
  ])

  return (
    <div className="mx-auto w-full max-w-4xl xl:max-w-6xl">
      <AccountHeader
        accountId={id}
        username={account.username}
        pfpUrl={account.pfpUrl}
        isOwner={isOwner}
        isBusiness={account.type === 'business'}
        members={members}
      />

      <div className="mt-6">
        <AccountTabs
          accountId={id}
          account={account}
          knowledgeBase={knowledgeBase}
          documents={documents}
          members={members}
          canEdit={canEdit}
          canManageMembers={canViewMembers}
          styleProfile={styleProfile}
        />
      </div>
    </div>
  )
}
