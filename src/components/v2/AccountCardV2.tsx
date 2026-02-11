'use client'

import { useState } from 'react'
import { User, Building2, Trash2 } from 'lucide-react'
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
  voiceMode: 'auto' | 'brand' | 'personal'
  signerStatus: 'pending' | 'approved' | 'revoked'
  isPremium?: boolean
  ownerId: string | null
  owner?: AccountOwner | null
}

interface AccountCardV2Props {
  account: Account
  currentUserId: string
  isAdmin: boolean
}

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
  approved: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  revoked: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400',
} as const

const statusLabels = {
  pending: 'Pending',
  approved: 'Active',
  revoked: 'Revoked',
} as const

export function AccountCardV2({ account, currentUserId, isAdmin }: AccountCardV2Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const isOwner = account.ownerId === currentUserId

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Account deleted')
      router.refresh()
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <Card
      className="p-4 hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full flex flex-col"
      onClick={() => router.push(`/v2/accounts/${account.id}/voice`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/v2/accounts/${account.id}/voice`)
        }
      }}
    >
      {/* Header: Avatar + Info */}
      <div className="flex items-start gap-3 mb-3">
        {account.pfpUrl ? (
          <img
            src={account.pfpUrl}
            alt={account.username}
            className="w-12 h-12 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {account.displayName || account.username}
            </span>
            {account.type === 'business' && (
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <span className="text-sm text-muted-foreground truncate block">
            @{account.username}
          </span>
        </div>
      </div>

      {/* Footer: Status + Actions */}
      <div
        className="flex items-center justify-between mt-auto pt-3 border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[account.signerStatus]}`}
          >
            {statusLabels[account.signerStatus]}
          </span>
          {isOwner && (
            <span className="text-xs text-muted-foreground">Owner</span>
          )}
        </div>

        {showConfirm ? (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-7 px-2 text-xs"
            >
              {isDeleting ? '...' : 'Yes'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              className="h-7 px-2 text-xs"
            >
              No
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowConfirm(true)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete account"
            aria-label="Delete account"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}
