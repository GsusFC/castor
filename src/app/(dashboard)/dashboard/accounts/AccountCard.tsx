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
    pending: 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
    approved: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    revoked: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400',
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
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Info de cuenta */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {account.pfpUrl ? (
            <img
              src={account.pfpUrl}
              alt={account.username}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">
                {account.displayName || account.username}
              </span>
              {account.type === 'business' && (
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              {isShared && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-xs rounded-full flex-shrink-0">
                  <Users className="w-3 h-3" />
                  <span className="hidden sm:inline">Compartida</span>
                </span>
              )}
              {isOwner && (
                <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full flex-shrink-0">
                  Tuya
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate">@{account.username}</span>
              {!isOwner && account.owner && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  · de @{account.owner.username}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
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
            className={isShared ? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400" : "text-muted-foreground"}
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
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Eliminar cuenta"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        </div>
      </div>
    </Card>
  )
}
