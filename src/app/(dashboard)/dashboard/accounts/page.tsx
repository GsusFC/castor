import { User } from 'lucide-react'
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
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display text-gray-900">Cuentas</h1>
          <p className="text-gray-500 mt-1">
            Gestiona las cuentas de Farcaster conectadas
          </p>
        </div>
        {accountsList.length > 0 && <AddAccountButton />}
      </div>

      {accountsList.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
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
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No hay cuentas conectadas</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Conecta tus cuentas de Farcaster para empezar a programar casts.
          Puedes añadir cuentas personales y de empresa.
        </p>
        <AddAccountButton />
      </CardContent>
    </Card>
  )
}

