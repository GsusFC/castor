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
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 lg:gap-8 max-w-4xl xl:max-w-6xl mx-auto">
      {/* Main Content */}
      <div className="w-full">
        {/* Header */}
        <div className="sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 sm:px-0">
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
        <div className="mt-6 space-y-6 px-4 sm:px-0">
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
                  <div className="space-y-3">
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
                  <div className="space-y-3">
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
      </div>

      {/* Right Sidebar - Stats */}
      <div className="hidden xl:block">
        <div className="sticky top-20 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-medium mb-3">Resumen</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cuentas</span>
                <span className="font-medium">{accountsList.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cuentas Pro</span>
                <span className="font-medium text-purple-500">{proAccounts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estándar</span>
                <span className="font-medium">{standardAccounts.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4">
            <h3 className="font-medium mb-2">¿Necesitas Pro?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              10,000 caracteres, 4 embeds, banners y más.
            </p>
            <Link
              href="https://farcaster.xyz/~/settings/pro"
              target="_blank"
              className="text-sm text-purple-500 hover:text-purple-400 font-medium"
            >
              Actualizar a Pro →
            </Link>
          </div>
        </div>
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

