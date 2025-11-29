import { User } from 'lucide-react'
import { db } from '@/lib/db'
import { AddAccountButton } from './add-account-button'
import { AccountCard } from './AccountCard'

export default async function AccountsPage() {
  const accountsList = await db.query.accounts.findMany({
    orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas</h1>
          <p className="text-gray-500 mt-1">
            Gestiona las cuentas de Farcaster conectadas
          </p>
        </div>
        <AddAccountButton />
      </div>

      {accountsList.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {accountsList.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border p-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <User className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold mb-2">No hay cuentas conectadas</h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Conecta tus cuentas de Farcaster para empezar a programar casts.
        Puedes añadir cuentas personales y de empresa.
      </p>
      <div className="flex justify-center">
        <AddAccountButton />
      </div>
    </div>
  )
}

