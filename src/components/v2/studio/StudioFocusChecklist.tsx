'use client'

import { CheckCircle2, AlertTriangle, XCircle, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'

type FocusNetwork = 'farcaster' | 'x' | 'linkedin'

interface StudioFocusChecklistProps {
  selectedNetworks: FocusNetwork[]
  availableNetworks: Record<FocusNetwork, boolean>
  hasContent: boolean
  hasMedia: boolean
  isMediaReady: boolean
  hasOverLimit: boolean
  networkLimits: Record<FocusNetwork, number>
  typefullyLinked: boolean
  scheduleReady: boolean
}

type RowStatus = 'ok' | 'warn' | 'error'

function statusMeta(status: RowStatus) {
  if (status === 'ok') {
    return {
      icon: CheckCircle2,
      iconClass: 'text-emerald-400',
      labelClass: 'text-foreground',
    }
  }
  if (status === 'warn') {
    return {
      icon: AlertTriangle,
      iconClass: 'text-amber-400',
      labelClass: 'text-foreground',
    }
  }
  return {
    icon: XCircle,
    iconClass: 'text-rose-400',
    labelClass: 'text-foreground',
  }
}

function networkLabel(network: FocusNetwork) {
  if (network === 'x') return 'X'
  if (network === 'linkedin') return 'LinkedIn'
  return 'Farcaster'
}

export function StudioFocusChecklist({
  selectedNetworks,
  availableNetworks,
  hasContent,
  hasMedia,
  isMediaReady,
  hasOverLimit,
  networkLimits,
  typefullyLinked,
  scheduleReady,
}: StudioFocusChecklistProps) {
  const hasDestinations = selectedNetworks.length > 0
  const needsTypefully = selectedNetworks.some((network) => network === 'x' || network === 'linkedin')

  const destinationStatus: RowStatus = hasDestinations ? 'ok' : 'error'
  const limitsStatus: RowStatus = hasOverLimit ? 'error' : 'ok'
  const mediaStatus: RowStatus = !hasMedia ? 'ok' : isMediaReady ? 'ok' : 'warn'
  const connectionStatus: RowStatus = !needsTypefully ? 'ok' : typefullyLinked ? 'ok' : 'error'
  const publishReady =
    hasDestinations && hasContent && !hasOverLimit && (!hasMedia || isMediaReady) && (!needsTypefully || typefullyLinked)
  const publishStatus: RowStatus = publishReady ? 'ok' : 'warn'

  const rows: Array<{ key: string; title: string; status: RowStatus; detail: string }> = [
    {
      key: 'destinations',
      title: 'Destinations',
      status: destinationStatus,
      detail: hasDestinations ? `${selectedNetworks.length} selected` : 'Pick at least one network',
    },
    {
      key: 'limits',
      title: 'Length & limits',
      status: limitsStatus,
      detail: hasOverLimit ? 'Over limit for at least one destination' : 'Within limits',
    },
    {
      key: 'media',
      title: 'Media readiness',
      status: mediaStatus,
      detail: !hasMedia ? 'No media attached' : isMediaReady ? 'Ready' : 'Uploading or processing',
    },
    {
      key: 'connection',
      title: 'Connection status',
      status: connectionStatus,
      detail: !needsTypefully ? 'Not required' : typefullyLinked ? 'Typefully linked' : 'Link Typefully for X/LinkedIn',
    },
    {
      key: 'publish',
      title: 'Publish readiness',
      status: publishStatus,
      detail: publishReady ? 'Ready to publish now' : scheduleReady ? 'Ready to schedule when blockers are resolved' : 'Needs validation before schedule',
    },
  ]

  return (
    <aside className="h-full rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Focus Checklist</p>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
          const meta = statusMeta(row.status)
          const Icon = meta.icon
          return (
            <div key={row.key} className="rounded-lg border border-border/60 bg-background/70 p-2.5">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4 shrink-0', meta.iconClass)} />
                <p className={cn('text-sm font-medium', meta.labelClass)}>{row.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
        <p className="text-xs font-medium text-muted-foreground">Networks</p>
        <div className="flex flex-wrap gap-1.5">
          {(['farcaster', 'x', 'linkedin'] as const).map((network) => {
            const selected = selectedNetworks.includes(network)
            const available = availableNetworks[network]
            return (
              <span
                key={network}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]',
                  selected && available && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                  !selected && available && 'border-border/70 bg-muted/40 text-muted-foreground',
                  !available && 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                )}
              >
                {networkLabel(network)}
              </span>
            )
          })}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border/60 bg-background/70 p-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Limits
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          X {networkLimits.x} · LinkedIn {networkLimits.linkedin} · Farcaster {networkLimits.farcaster}
        </p>
      </div>
    </aside>
  )
}
