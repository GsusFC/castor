import { User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { db, accounts } from '@/lib/db'
import { AddAccountButton } from './add-account-button'
import { AccountCard } from './AccountCard'
import { getSession } from '@/lib/auth'
import { eq, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Obtener cuentas propias + compartidas
  const accountsList = await db.query.accounts.findMany({
    where: or(
      eq(accounts.ownerId, session.userId),
      eq(accounts.isShared, true)
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link 
          href="/dashboard"
          className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-lg border border-border hover:bg-muted transition-colors touch-target"
        >
          <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-display text-foreground">Cuentas</h1>
          <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
            Gestiona las cuentas de Farcaster conectadas
          </p>
        </div>
        {accountsList.length > 0 && <AddAccountButton variant="icon" />}
      </div>

      {accountsList.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {accountsList.map((account) => (
            <AccountCard 
              key={account.id} 
              account={account} 
              currentUserId={session.userId}
              isAdmin={session.role === 'admin'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="text-center">
      <CardContent className="pt-12 pb-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No hay cuentas conectadas</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Conecta tus cuentas de Farcaster para empezar a programar casts.
          Puedes añadir cuentas personales y de empresa.
        </p>
        <AddAccountButton />
      </CardContent>
    </Card>
  )
}

