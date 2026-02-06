'use client'

import { useMemo } from 'react'
import { AppHeader } from '@/components/v2/AppHeader'
import { StudioLayout } from '@/components/v2/StudioLayout'
import { CalendarView } from '@/components/calendar/CalendarView'
import { Clock, FileText, Pen } from 'lucide-react'

// Types matching serialized data from server
interface Account {
  id: string
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
  signerStatus: string
  type: string
  isPremium: boolean
  ownerId: string | null
  owner: { id: string; username: string; displayName: string | null; pfpUrl: string | null } | null
  hasBrandVoice: boolean
}

interface Cast {
  id: string
  content: string
  status: string
  scheduledAt: string
  publishedAt: string | null
  castHash: string | null
  channelId: string | null
  errorMessage: string | null
  retryCount: number
  accountId: string
  account: { id: string; username: string; displayName: string | null; pfpUrl: string | null } | null
  createdBy: { id: string; username: string; displayName: string | null; pfpUrl: string | null } | null
  media: Array<{
    id: string
    url: string
    type: 'image' | 'video'
    thumbnailUrl: string | null
  }>
}

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface StudioV2ClientProps {
  user: {
    userId: string
    fid: number
    username: string
    displayName: string | null
    pfpUrl: string | null
    role: string
  }
  accounts: Account[]
  casts: Cast[]
  templates: Template[]
}

export function StudioV2Client({ user, accounts, casts, templates }: StudioV2ClientProps) {
  const approvedAccounts = accounts.filter(a => a.signerStatus === 'approved')

  // Upcoming casts sorted by date
  const upcomingCasts = useMemo(() => {
    return casts
      .filter(c => c.status === 'scheduled' || c.status === 'draft')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 10)
  }, [casts])

  // Published casts for activity
  const recentActivity = useMemo(() => {
    return casts
      .filter(c => c.status === 'published')
      .sort((a, b) => new Date(b.publishedAt || b.scheduledAt).getTime() - new Date(a.publishedAt || a.scheduledAt).getTime())
      .slice(0, 15)
  }, [casts])

  const handleMoveCast = async (castId: string, newDate: Date) => {
    try {
      await fetch(`/api/casts/${castId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      })
    } catch (error) {
      console.error('Failed to move cast:', error)
    }
  }

  return (
    <>
      <AppHeader
        user={{
          username: user.username,
          displayName: user.displayName,
          pfpUrl: user.pfpUrl,
        }}
        accounts={approvedAccounts.map(a => ({
          id: a.id,
          username: a.username,
          pfpUrl: a.pfpUrl,
        }))}
      />

      <StudioLayout
        composerPanel={<ComposerPanelStub />}
        calendarPanel={
          <CalendarView
            casts={casts.map(c => ({
              id: c.id,
              content: c.content || '',
              status: c.status,
              scheduledAt: new Date(c.scheduledAt),
              account: c.account ? { username: c.account.username, pfpUrl: c.account.pfpUrl } : null,
            }))}
            onMoveCast={handleMoveCast}
          />
        }
        queuePanel={<QueuePanel casts={upcomingCasts} />}
        activityPanel={<ActivityPanel casts={recentActivity} />}
      />
    </>
  )
}

// ─── Stub: Composer Panel (Phase 2 will replace this) ────────────────────────

function ComposerPanelStub() {
  return (
    <div className="flex flex-col h-full">
      {/* Composer Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Pen className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Composer</span>
      </div>

      {/* Composer Body — empty state */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Pen className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Ready to compose
        </p>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Write your cast here. Click a day on the calendar to set the schedule date.
        </p>
      </div>
    </div>
  )
}

// ─── Queue Panel ─────────────────────────────────────────────────────────────

function QueuePanel({ casts }: { casts: Cast[] }) {
  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <Clock className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No scheduled casts</p>
        <p className="text-xs text-muted-foreground/70">Write something in the composer to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {casts.map(cast => (
        <div
          key={cast.id}
          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
        >
          {/* Account avatar */}
          {cast.account?.pfpUrl ? (
            <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">{cast.content || 'Empty cast'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {new Date(cast.scheduledAt).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(cast.scheduledAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {cast.status === 'draft' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                  Draft
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Activity Panel ──────────────────────────────────────────────────────────

function ActivityPanel({ casts }: { casts: Cast[] }) {
  if (casts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <FileText className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No published casts yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {casts.map(cast => (
        <div
          key={cast.id}
          className="flex items-start gap-3 p-3 rounded-lg border bg-card"
        >
          {cast.account?.pfpUrl ? (
            <img src={cast.account.pfpUrl} alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">{cast.content || 'Empty cast'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                Published{' '}
                {new Date(cast.publishedAt || cast.scheduledAt).toLocaleDateString('en-US', {
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
                >
                  View on Warpcast
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
