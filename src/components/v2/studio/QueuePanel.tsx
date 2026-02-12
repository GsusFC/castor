'use client'

import { useState } from 'react'
import { Clock, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatStudioDate, formatStudioTime } from '@/lib/studio-datetime'
import type { SerializedCast } from '@/types'

type QueuePanelProps = {
  casts: SerializedCast[]
  viewMode?: 'list' | 'grid'
  onSelectCast: (castId: string) => void
  onStartCast: () => void
  onDeleteCast: (castId: string) => void | Promise<void>
  onDuplicateCast: (castId: string) => void | Promise<void>
  onLoadMore: () => void
  isLoadingMore: boolean
  hasMore: boolean
  locale: string
  timeZone: string
}

type CastNetwork = 'farcaster' | 'x' | 'linkedin'

function getCastNetwork(cast: SerializedCast): CastNetwork {
  if (cast.network) return cast.network
  if (cast.publishTargets?.includes('x')) return 'x'
  if (cast.publishTargets?.includes('linkedin')) return 'linkedin'
  return 'farcaster'
}

function getNetworkTone(network: CastNetwork) {
  if (network === 'x') return 'border-zinc-500/55 bg-zinc-500/10 hover:bg-zinc-500/15'
  if (network === 'linkedin') return 'border-sky-500/55 bg-sky-500/10 hover:bg-sky-500/15'
  return 'border-indigo-500/55 bg-indigo-500/10 hover:bg-indigo-500/15'
}

function getNetworkBadge(network: CastNetwork) {
  if (network === 'x') {
    return { label: 'X', icon: 'X', className: 'border-zinc-500/60 bg-zinc-500/15 text-zinc-200' }
  }
  if (network === 'linkedin') {
    return { label: 'LinkedIn', icon: 'in', className: 'border-sky-500/60 bg-sky-500/15 text-sky-200' }
  }
  return {
    label: 'Farcaster',
    icon: 'F',
    className: 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200',
  }
}

export function QueuePanel({
  casts,
  viewMode = 'grid',
  onSelectCast,
  onStartCast,
  onDeleteCast,
  onDuplicateCast,
  onLoadMore,
  isLoadingMore,
  hasMore,
  locale,
  timeZone,
}: QueuePanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const draftCount = casts.filter(c => c.status === 'draft').length
  const scheduledCount = casts.filter(c => c.status === 'scheduled').length

  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <Clock className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No scheduled casts</p>
        <p className="text-xs text-muted-foreground/70">Create your next cast from the composer panel</p>
        <button
          type="button"
          onClick={onStartCast}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Start new cast
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        {scheduledCount > 0 && <span>{scheduledCount} scheduled</span>}
        {scheduledCount > 0 && draftCount > 0 && <span>&middot;</span>}
        {draftCount > 0 && <span>{draftCount} drafts</span>}
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-2.5' : 'space-y-2.5'}>
        {casts.map((cast) => {
          const network = getCastNetwork(cast)
          const networkBadge = getNetworkBadge(network)
          return (
            <div
              key={cast.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCast(cast.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectCast(cast.id)
                }
              }}
              className={cn(
                'group w-full text-left p-3 rounded-lg border transition-colors cursor-pointer',
                getNetworkTone(network)
              )}
            >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2 py-1">
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatStudioDate(cast.scheduledAt, {
                    locale,
                    timeZone,
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatStudioTime(cast.scheduledAt, {
                    locale,
                    timeZone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                    networkBadge.className
                  )}
                >
                  <span className="inline-flex size-3 items-center justify-center rounded-[3px] border border-current/40 text-[9px] leading-none">
                    {networkBadge.icon}
                  </span>
                  {networkBadge.label}
                </span>
                {cast.status === 'draft' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                    Draft
                  </span>
                )}
                {cast.status === 'retrying' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-medium">
                    Retrying
                  </span>
                )}
                {cast.status === 'failed' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-medium">
                    Failed
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              {cast.account?.pfpUrl ? (
                <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-3 text-pretty">{cast.content || 'Empty cast'}</p>
                {cast.account?.username && (
                  <p className="text-[11px] text-muted-foreground mt-1">@{cast.account.username}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title="Duplicate as draft"
                  disabled={duplicatingId === cast.id || deletingId === cast.id}
                  onClick={async (e) => {
                    e.stopPropagation()
                    setDuplicatingId(cast.id)
                    try {
                      await Promise.resolve(onDuplicateCast(cast.id))
                    } finally {
                      setDuplicatingId(null)
                    }
                  }}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete cast"
                  disabled={duplicatingId === cast.id || deletingId === cast.id}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(cast.id) }}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          className="w-full rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {isLoadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete cast</DialogTitle>
            <DialogDescription>
              This will permanently delete the cast. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!deleteTarget || deletingId === deleteTarget}
              onClick={async () => {
                if (deleteTarget) {
                  setDeletingId(deleteTarget)
                  try {
                    await Promise.resolve(onDeleteCast(deleteTarget))
                    setDeleteTarget(null)
                  } finally {
                    setDeletingId(null)
                  }
                }
              }}
            >
              {deleteTarget && deletingId === deleteTarget ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
