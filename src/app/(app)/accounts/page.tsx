import { User, Users, Shield, Star } from 'lucide-react'
import Link from 'next/link'
import { db, accounts, accountMembers } from '@/lib/db'
import { AddAccountButton } from './add-account-button'
import { AccountCard } from './AccountCard'
import { AccountsClient } from './AccountsClient'
import { getSession } from '@/lib/auth'
import { and, eq, exists, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Obtener cuentas propias + donde es miembro
  const accountsList = await db.query.accounts.findMany({
    where: or(
      eq(accounts.ownerId, session.userId),
      exists(
        db
          .select({ id: accountMembers.id })
          .from(accountMembers)
          .where(and(eq(accountMembers.userId, session.userId), eq(accountMembers.accountId, accounts.id)))
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

  const proAccounts = accountsList.filter(a => a.isPremium)
  const standardAccounts = accountsList.filter(a => !a.isPremium)

  return (
    <div className="mx-auto w-full max-w-4xl xl:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Cuentas</h1>
              <p className="text-sm text-muted-foreground">{accountsList.length} conectadas</p>
            </div>
          </div>
          <AddAccountButton />
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 space-y-6">
        {accountsList.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Pro Accounts */}
            {proAccounts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-purple-500" />
                  <h2 className="text-sm font-medium text-muted-foreground">Cuentas Pro</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {proAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      currentUserId={session.userId}
                      isAdmin={session.role === 'admin'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Standard Accounts */}
            {standardAccounts.length > 0 && (
              <div>
                {proAccounts.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-muted-foreground">Cuentas estándar</h2>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {standardAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      currentUserId={session.userId}
                      isAdmin={session.role === 'admin'}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de conectar cuenta */}
      <Suspense fallback={null}>
        <AccountsClient />
      </Suspense>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <User className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No hay cuentas conectadas</h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Conecta tus cuentas de Farcaster para empezar a programar casts y gestionar tu presencia.
      </p>
      <AddAccountButton />
    </div>
  )
}

