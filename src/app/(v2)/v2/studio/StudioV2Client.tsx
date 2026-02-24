'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { AppHeader } from '@/components/v2/AppHeader'
import { StudioLayout } from '@/components/v2/StudioLayout'
import { ComposerPanel, ComposerPanelRef } from '@/components/v2/ComposerPanel'
import { CalendarView } from '@/components/calendar/CalendarView'
import { SelectedAccountV2Provider } from '@/context/SelectedAccountV2Context'
import { AccountFilterControl } from '@/components/v2/studio/AccountFilterControl'
import { DailyQueuePanel } from '@/components/v2/studio/DailyQueuePanel'
import { QueuePanel } from '@/components/v2/studio/QueuePanel'
import { ActivityPanel } from '@/components/v2/studio/ActivityPanel'
import { StudioCalendarRail } from '@/components/v2/studio/StudioCalendarRail'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getStudioLocale, getStudioTimeZone } from '@/lib/studio-datetime'
import { useStudioV2State } from '@/hooks/useStudioV2State'
import { useStudioComposerBridge } from '@/hooks/useStudioComposerBridge'
import { useStudioAccounts } from '@/hooks/useStudioAccounts'
import { useStudioCalendarCasts } from '@/hooks/useStudioCalendarCasts'
import { toast } from 'sonner'
import type {
  SerializedAccount,
  SerializedCast,
  SerializedTemplate,
  SessionUser,
} from '@/types'

interface StudioV2ClientProps {
  user: SessionUser
  accounts: SerializedAccount[]
  casts: SerializedCast[]
  templates: SerializedTemplate[]
}

const OPEN_COMPOSE_ON_DATE_EVENT = 'castor:studio-open-compose-on-date'
const SCROLL_TO_TODAY_EVENT = 'castor:studio-scroll-to-today'
const DESKTOP_FOCUS_STORAGE_KEY = 'castor:studio:v2:desktop-focus-mode'
type DesktopFocusMode = 'normal' | 'composer'

export function StudioV2Client({ user, accounts, casts, templates }: StudioV2ClientProps) {
  const composerRef = useRef<ComposerPanelRef>(null)
  const [desktopFocusMode, setDesktopFocusMode] = useState<DesktopFocusMode>('normal')
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)

  const {
    approvedAccounts,
    defaultAccountId,
    headerAccounts,
    filterAccounts,
  } = useStudioAccounts({
    accounts,
    userFid: user.fid,
  })

  // Keep server/client first render consistent to avoid hydration text mismatches.
  const [locale, setLocale] = useState('en-US')
  const [timeZone, setTimeZone] = useState('UTC')

  useEffect(() => {
    setLocale(getStudioLocale())
    setTimeZone(getStudioTimeZone())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(DESKTOP_FOCUS_STORAGE_KEY)
      if (stored === 'normal' || stored === 'composer') {
        setDesktopFocusMode(stored)
      }
    } catch {
      // noop
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktopViewport(media.matches)
    update()

    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const setFocusMode = (mode: DesktopFocusMode) => {
    setDesktopFocusMode(mode)
    try {
      window.localStorage.setItem(DESKTOP_FOCUS_STORAGE_KEY, mode)
    } catch {
      // noop
    }
  }

  const {
    accountFilter,
    setAccountFilter,
    filteredCasts,
    upcomingCasts,
    recentActivity,
    queueHasMore,
    activityHasMore,
    isLoadingMoreQueue,
    isLoadingMoreActivity,
    allKnownCasts,
    loadMoreQueue,
    loadMoreActivity,
    handleMoveCast,
    handleDeleteCast,
    handleDuplicateCast,
    handleCastCreated,
  } = useStudioV2State({
    casts,
    templates,
    approvedAccountIds: approvedAccounts.map((a) => a.id),
  })

  const {
    handleSelectDate,
    handleSelectCast,
    handleStartCast,
  } = useStudioComposerBridge({
    composerRef,
    allKnownCasts,
  })
  const calendarCasts = useStudioCalendarCasts({ casts: filteredCasts })

  const handleCreateOnDate = (date: Date) => {
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (selected < today) {
      toast.error('You cannot schedule casts in past days')
      return
    }

    handleSelectDate(date)

    if (typeof window !== 'undefined') {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const dateString = `${y}-${m}-${d}`

      window.dispatchEvent(
        new CustomEvent(OPEN_COMPOSE_ON_DATE_EVENT, {
          detail: { date: dateString },
        })
      )
    }
  }

  const combinedCasts = useMemo(() => {
    return [...allKnownCasts]
      .filter((cast) => (accountFilter === 'all' ? true : cast.accountId === accountFilter))
      .sort((a, b) => {
        const aTime = new Date(a.publishedAt || a.scheduledAt).getTime()
        const bTime = new Date(b.publishedAt || b.scheduledAt).getTime()
        return aTime - bTime
      })
  }, [allKnownCasts, accountFilter])

  const selectedAccountLabel = useMemo(() => {
    if (accountFilter === 'all') return 'All'
    const account = filterAccounts.find((a) => a.id === accountFilter)
    return account ? `@${account.username}` : 'Account'
  }, [accountFilter, filterAccounts])
  const isCalendarCollapsed = isDesktopViewport && desktopFocusMode === 'composer'

  const todayStats = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const toKey = (date: Date) => {
      const parts = formatter.formatToParts(date)
      const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
      const month = parts.find((p) => p.type === 'month')?.value ?? '00'
      const day = parts.find((p) => p.type === 'day')?.value ?? '00'
      return `${year}-${month}-${day}`
    }

    const todayKey = toKey(new Date())
    let scheduledCount = 0
    let publishedCount = 0

    for (const cast of combinedCasts) {
      const referenceDate = new Date(cast.publishedAt || cast.scheduledAt)
      if (toKey(referenceDate) !== todayKey) continue
      if (cast.status === 'published') publishedCount += 1
      if (cast.status === 'scheduled') scheduledCount += 1
    }

    return { scheduledCount, publishedCount }
  }, [combinedCasts, locale, timeZone])

  const handleLoadMoreCombined = () => {
    if (queueHasMore) void loadMoreQueue()
    if (activityHasMore) void loadMoreActivity()
  }

  const hasMoreCombined = queueHasMore || activityHasMore
  const isLoadingMoreCombined = isLoadingMoreQueue || isLoadingMoreActivity
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone }),
    [locale, timeZone]
  )

  return (
    <SelectedAccountV2Provider defaultAccountId={defaultAccountId}>
      <div className="hidden sm:block">
        <AppHeader
          user={{
            username: user.username,
            displayName: user.displayName,
            pfpUrl: user.pfpUrl,
          }}
          accounts={headerAccounts}
        />
      </div>

      <StudioLayout
        isCalendarCollapsed={isCalendarCollapsed}
        onToggleCalendarCollapsed={() => {
          setFocusMode(isCalendarCollapsed ? 'normal' : 'composer')
        }}
        calendarRail={
          <StudioCalendarRail
            todayLabel={todayLabel}
            scheduledCount={todayStats.scheduledCount}
            publishedCount={todayStats.publishedCount}
            onExpand={() => setFocusMode('normal')}
          />
        }
        composerPanel={
          <ComposerPanel
            ref={composerRef}
            accounts={approvedAccounts}
            userFid={user.fid}
            defaultAccountId={defaultAccountId}
            templates={templates}
            onCastCreated={handleCastCreated}
          />
        }
        rightPanelControls={(
          <>
            <div className="sm:hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold leading-none">Studio</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Daily agenda</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent(SCROLL_TO_TODAY_EVENT))
                    }
                  }}
                  className="h-8 rounded-md border border-[#B89C7A]/60 bg-[#B89C7A]/15 px-2.5 text-xs font-semibold text-foreground hover:bg-[#B89C7A]/25 transition-colors inline-flex items-center gap-1.5"
                >
                  Today
                  <span className="text-[11px] text-foreground/80">{todayLabel}</span>
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-8 rounded-md border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                      aria-label="Filter account"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {selectedAccountLabel}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setAccountFilter('all')}>
                      All accounts
                    </DropdownMenuItem>
                    {filterAccounts.map((account) => (
                      <DropdownMenuItem key={account.id} onClick={() => setAccountFilter(account.id)}>
                        @{account.username}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="hidden sm:flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFocusMode(isCalendarCollapsed ? 'normal' : 'composer')}
                className="h-8 rounded-md border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {isCalendarCollapsed ? 'Show calendar' : 'Focus composer'}
              </button>
              <AccountFilterControl
                accountFilter={accountFilter}
                onChange={setAccountFilter}
                accounts={filterAccounts}
              />
            </div>
          </>
        )}
        rightPanel={
          <DailyQueuePanel
            casts={combinedCasts}
            onSelectCast={handleSelectCast}
            onStartCast={handleStartCast}
            onCreateOnDate={handleCreateOnDate}
            onDeleteCast={handleDeleteCast}
            onDuplicateCast={handleDuplicateCast}
            onLoadMore={hasMoreCombined ? handleLoadMoreCombined : undefined}
            isLoadingMore={isLoadingMoreCombined}
            hasMore={hasMoreCombined}
            locale={locale}
            timeZone={timeZone}
          />
        }
        calendarPanel={
          <CalendarView
            casts={calendarCasts}
            onMoveCast={handleMoveCast}
            onSelectDate={handleSelectDate}
            onSelectCast={handleSelectCast}
            onDuplicateCast={handleDuplicateCast}
            onDeleteCast={handleDeleteCast}
            locale={locale}
            timeZone={timeZone}
            weekStartsOn={1}
          />
        }
        queuePanel={
          <QueuePanel
            casts={upcomingCasts}
            onSelectCast={handleSelectCast}
            onStartCast={handleStartCast}
            onDeleteCast={handleDeleteCast}
            onDuplicateCast={handleDuplicateCast}
            onLoadMore={loadMoreQueue}
            isLoadingMore={isLoadingMoreQueue}
            hasMore={queueHasMore}
            locale={locale}
            timeZone={timeZone}
          />
        }
        activityPanel={
          <ActivityPanel
            casts={recentActivity}
            onSelectCast={handleSelectCast}
            onStartCast={handleStartCast}
            onDuplicateCast={handleDuplicateCast}
            onLoadMore={loadMoreActivity}
            isLoadingMore={isLoadingMoreActivity}
            hasMore={activityHasMore}
            locale={locale}
            timeZone={timeZone}
          />
        }
      />
    </SelectedAccountV2Provider>
  )
}

export { QueuePanel } from '@/components/v2/studio/QueuePanel'
export { ActivityPanel } from '@/components/v2/studio/ActivityPanel'
