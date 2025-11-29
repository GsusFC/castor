'use client'

import { useState } from 'react'
import { User, Building2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Account {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
  type: 'personal' | 'business'
  signerStatus: 'pending' | 'approved' | 'revoked'
}

export function AccountCard({ account }: { account: Account }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    revoked: 'bg-red-100 text-red-800',
  }

  const statusLabels = {
    pending: 'Pendiente',
    approved: 'Activa',
    revoked: 'Revocada',
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Error al eliminar')
      }

      router.refresh()
    } catch (error) {
      console.error('Error deleting account:', error)
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {account.pfpUrl ? (
          <img
            src={account.pfpUrl}
            alt={account.username}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {account.displayName || account.username}
            </span>
            {account.type === 'business' && (
              <Building2 className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <span className="text-sm text-gray-500">@{account.username}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[account.signerStatus]}`}
        >
          {statusLabels[account.signerStatus]}
        </span>
        
        {showConfirm ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Eliminando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
            title="Eliminar cuenta"
          >
            <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
          </button>
        )}
      </div>
    </div>
  )
}
