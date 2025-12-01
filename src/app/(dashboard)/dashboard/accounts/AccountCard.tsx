'use client'

import { useState } from 'react'
import { User, Building2, Trash2, Share2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface AccountOwner {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

interface Account {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
  type: 'personal' | 'business'
  signerStatus: 'pending' | 'approved' | 'revoked'
  ownerId: string | null
  isShared: boolean
  owner?: AccountOwner | null
}

interface AccountCardProps {
  account: Account
  currentUserId: string
  isAdmin: boolean
}

export function AccountCard({ account, currentUserId, isAdmin }: AccountCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isShared, setIsShared] = useState(account.isShared)
  const router = useRouter()
  
  const isOwner = account.ownerId === currentUserId
  const canShare = isAdmin // Solo admins pueden compartir

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
      
      toast.success('Cuenta eliminada')
      router.refresh()
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Error al eliminar la cuenta')
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  const handleToggleShare = async () => {
    setIsSharing(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShared: !isShared }),
      })

      if (!res.ok) {
        throw new Error('Error al compartir')
      }

      setIsShared(!isShared)
      toast.success(isShared ? 'Cuenta dejada de compartir' : 'Cuenta compartida con el equipo')
      router.refresh()
    } catch (error) {
      console.error('Error sharing account:', error)
      toast.error('Error al cambiar estado compartido')
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Card className="p-4 flex items-center justify-between">
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
            {isShared && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                <Users className="w-3 h-3" />
                Compartida
              </span>
            )}
            {isOwner && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                Tuya
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">@{account.username}</span>
            {!isOwner && account.owner && (
              <span className="text-xs text-gray-400">
                · de @{account.owner.username}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[account.signerStatus]}`}
        >
          {statusLabels[account.signerStatus]}
        </span>
        
        {canShare && (
          <Button
            variant={isShared ? "secondary" : "ghost"}
            size="icon"
            onClick={handleToggleShare}
            disabled={isSharing}
            title={isShared ? 'Dejar de compartir' : 'Compartir con el equipo'}
            className={isShared ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-gray-400"}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        )}
        
        {showConfirm ? (
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '...' : 'Confirmar'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowConfirm(true)}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
            title="Eliminar cuenta"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}
