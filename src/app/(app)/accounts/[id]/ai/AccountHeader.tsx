'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShareAccountModal } from './ShareAccountModal'
import type { AccountMember } from '@/lib/db'

type MemberWithUser = AccountMember & {
  user: { id: string; username: string; displayName: string | null; pfpUrl: string | null }
}

interface AccountHeaderProps {
  accountId: string
  username: string
  pfpUrl: string | null
  isOwner: boolean
  isBusiness: boolean
  members: MemberWithUser[]
}

export function AccountHeader({
  accountId,
  username,
  pfpUrl,
  isOwner,
  isBusiness,
  members,
}: AccountHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false)

  const canShare = isOwner && isBusiness

  return (
    <>
      <div className="sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3">
          <Link
            href="/accounts"
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {pfpUrl ? (
            <img src={pfpUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 bg-muted rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">@{username}</h1>
          </div>

          {canShare && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}
        </div>
      </div>

      {canShare && (
        <ShareAccountModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          accountId={accountId}
          members={members}
        />
      )}
    </>
  )
}
