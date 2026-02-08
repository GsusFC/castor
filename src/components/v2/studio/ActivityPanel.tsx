'use client'

import { Copy, FileText } from 'lucide-react'
import { formatStudioDate } from '@/lib/studio-datetime'
import type { SerializedCast } from '@/types'

type ActivityPanelProps = {
  casts: SerializedCast[]
  onSelectCast: (castId: string) => void
  onStartCast: () => void
  onDuplicateCast: (castId: string) => void
  onLoadMore: () => void
  isLoadingMore: boolean
  hasMore: boolean
  locale: string
  timeZone: string
}

export function ActivityPanel({
  casts,
  onSelectCast,
  onStartCast,
  onDuplicateCast,
  onLoadMore,
  isLoadingMore,
  hasMore,
  locale,
  timeZone,
}: ActivityPanelProps) {
  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No published casts yet</p>
        <p className="text-xs text-muted-foreground/70">Publish from the composer to build activity history</p>
        <button
          type="button"
          onClick={onStartCast}
          className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Create first cast
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {casts.map(cast => (
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
          className="group w-full text-left flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
        >
          {cast.account?.pfpUrl ? (
            <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2 text-pretty">{cast.content || 'Empty cast'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs tabular-nums text-muted-foreground">
                Published {formatStudioDate(cast.publishedAt || cast.scheduledAt, {
                  locale,
                  timeZone,
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {cast.castHash && (
                <a
                  href={`https://warpcast.com/~/conversations/${cast.castHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on Warpcast
                </a>
              )}
            </div>
          </div>

          <button
            type="button"
            title="Duplicate as draft"
            onClick={(e) => { e.stopPropagation(); onDuplicateCast(cast.id) }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

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
    </div>
  )
}
