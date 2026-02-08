'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, LayoutGrid, List, SlidersHorizontal } from 'lucide-react'
import { AppHeader } from '@/components/v2/AppHeader'
import { StudioLayout } from '@/components/v2/StudioLayout'
import { ComposerPanel, ComposerPanelRef } from '@/components/v2/ComposerPanel'
import { CalendarView } from '@/components/calendar/CalendarView'
import { SelectedAccountV2Provider } from '@/context/SelectedAccountV2Context'
import { QueuePanel } from '@/components/v2/studio/QueuePanel'
import { ActivityPanel } from '@/components/v2/studio/ActivityPanel'
import { TemplatesPanel } from '@/components/v2/studio/TemplatesPanel'
import { AccountFilterControl } from '@/components/v2/studio/AccountFilterControl'
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

type ViewMode = 'list' | 'grid'
type SortMode = 'newest' | 'oldest'
type ViewModeTab = 'queue' | 'activity' | 'templates'

const DEFAULT_VIEW_MODES: Record<ViewModeTab, ViewMode> = {
  queue: 'grid',
  activity: 'grid',
  templates: 'grid',
}

const DEFAULT_SORT_MODES: Record<ViewModeTab, SortMode> = {
  queue: 'newest',
  activity: 'newest',
  templates: 'newest',
}

function getSortLabel(tab: ViewModeTab, mode: SortMode): string {
  if (tab === 'templates') {
    return mode === 'newest' ? 'Name Z-A' : 'Name A-Z'
  }
  return mode === 'newest' ? 'Date: Newest' : 'Date: Oldest'
}

function getSortShortLabel(tab: ViewModeTab, mode: SortMode): string {
  if (tab === 'templates') {
    return mode === 'newest' ? 'Z-A' : 'A-Z'
  }
  return mode === 'newest' ? 'New' : 'Old'
}

export function StudioV2Client({ user, accounts, casts, templates }: StudioV2ClientProps) {
  const composerRef = useRef<ComposerPanelRef>(null)
  const [viewModes, setViewModes] = useState<Record<ViewModeTab, ViewMode>>(DEFAULT_VIEW_MODES)
  const [sortModes, setSortModes] = useState<Record<ViewModeTab, SortMode>>(DEFAULT_SORT_MODES)
  const {
    approvedAccounts,
    defaultAccountId,
    headerAccounts,
    filterAccounts,
  } = useStudioAccounts({
    accounts,
    userFid: user.fid,
  })

  const locale = useMemo(() => getStudioLocale(), [])
  const timeZone = useMemo(() => getStudioTimeZone(), [])
  const {
    accountFilter,
    setAccountFilter,
    filteredCasts,
    upcomingCasts,
    recentActivity,
    studioTemplates,
    isLoadingMoreQueue,
    isLoadingMoreActivity,
    queueHasMore,
    activityHasMore,
    allKnownCasts,
    loadMoreQueue,
    loadMoreActivity,
    handleMoveCast,
    handleDeleteCast,
    handleDuplicateCast,
    handleCastCreated,
    handleDeleteTemplate,
  } = useStudioV2State({
    casts,
    templates,
    approvedAccountIds: approvedAccounts.map((a) => a.id),
  })

  const {
    handleSelectDate,
    handleSelectCast,
    handleStartCast,
    handleLoadTemplateFromPanel,
  } = useStudioComposerBridge({
    composerRef,
    allKnownCasts,
  })
  const calendarCasts = useStudioCalendarCasts({ casts: filteredCasts })

  useEffect(() => {
    try {
      const queue = localStorage.getItem('studio-v2-view-mode-queue')
      const activity = localStorage.getItem('studio-v2-view-mode-activity')
      const templatesMode = localStorage.getItem('studio-v2-view-mode-templates')
      const queueSort = localStorage.getItem('studio-v2-sort-mode-queue')
      const activitySort = localStorage.getItem('studio-v2-sort-mode-activity')
      const templatesSort = localStorage.getItem('studio-v2-sort-mode-templates')

      setViewModes({
        queue: queue === 'list' || queue === 'grid' ? queue : DEFAULT_VIEW_MODES.queue,
        activity: activity === 'list' || activity === 'grid' ? activity : DEFAULT_VIEW_MODES.activity,
        templates: templatesMode === 'list' || templatesMode === 'grid' ? templatesMode : DEFAULT_VIEW_MODES.templates,
      })
      setSortModes({
        queue: queueSort === 'oldest' || queueSort === 'newest' ? queueSort : DEFAULT_SORT_MODES.queue,
        activity: activitySort === 'oldest' || activitySort === 'newest' ? activitySort : DEFAULT_SORT_MODES.activity,
        templates: templatesSort === 'oldest' || templatesSort === 'newest' ? templatesSort : DEFAULT_SORT_MODES.templates,
      })
    } catch {
      setViewModes(DEFAULT_VIEW_MODES)
      setSortModes(DEFAULT_SORT_MODES)
    }
  }, [])

  const setViewMode = (tab: ViewModeTab, mode: ViewMode) => {
    setViewModes((prev) => ({ ...prev, [tab]: mode }))
    try {
      localStorage.setItem(`studio-v2-view-mode-${tab}`, mode)
    } catch {}
  }

  const setSortMode = (tab: ViewModeTab, mode: SortMode) => {
    setSortModes((prev) => ({ ...prev, [tab]: mode }))
    try {
      localStorage.setItem(`studio-v2-sort-mode-${tab}`, mode)
    } catch {}
  }

  const queueItems = useMemo(
    () => [...upcomingCasts].sort((a, b) => sortModes.queue === 'newest'
      ? new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      : new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [upcomingCasts, sortModes.queue]
  )

  const activityItems = useMemo(
    () => [...recentActivity].sort((a, b) => {
      const aTime = new Date(a.publishedAt || a.scheduledAt).getTime()
      const bTime = new Date(b.publishedAt || b.scheduledAt).getTime()
      return sortModes.activity === 'newest' ? bTime - aTime : aTime - bTime
    }),
    [recentActivity, sortModes.activity]
  )

  const templateItems = useMemo(
    () => [...studioTemplates].sort((a, b) => sortModes.templates === 'newest'
      ? b.name.localeCompare(a.name)
      : a.name.localeCompare(b.name)),
    [studioTemplates, sortModes.templates]
  )

  const selectedAccountLabel = useMemo(() => {
    if (accountFilter === 'all') return 'All'
    const account = filterAccounts.find((a) => a.id === accountFilter)
    return account ? `@${account.username}` : 'Account'
  }, [accountFilter, filterAccounts])

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
        rightPanelControls={(activeTab) => (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {(activeTab === 'queue' || activeTab === 'activity' || activeTab === 'templates') && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden sm:flex items-center rounded-md border p-0.5">
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setViewMode(activeTab, 'list')}
                    className={`h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors ${
                      viewModes[activeTab] === 'list'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setViewMode(activeTab, 'grid')}
                    className={`h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors ${
                      viewModes[activeTab] === 'grid'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-7 rounded-md border px-2 text-[11px] sm:text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                    >
                      <span className="sm:hidden">{getSortShortLabel(activeTab, sortModes[activeTab])}</span>
                      <span className="hidden sm:inline">{getSortLabel(activeTab, sortModes[activeTab])}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {activeTab === 'templates' ? (
                      <>
                        <DropdownMenuItem onClick={() => setSortMode(activeTab, 'oldest')}>
                          Name A-Z
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortMode(activeTab, 'newest')}>
                          Name Z-A
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => setSortMode(activeTab, 'newest')}>
                          Date: Newest first
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortMode(activeTab, 'oldest')}>
                          Date: Oldest first
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <div className="hidden sm:block">
              <AccountFilterControl
                accountFilter={accountFilter}
                onChange={setAccountFilter}
                accounts={filterAccounts}
              />
            </div>
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-7 rounded-md border px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                    aria-label="Filter account"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    {selectedAccountLabel}
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
        )}
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
            casts={queueItems}
            viewMode={viewModes.queue}
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
            casts={activityItems}
            viewMode={viewModes.activity}
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
        templatesPanel={
          <TemplatesPanel
            templates={templateItems}
            viewMode={viewModes.templates}
            onLoadTemplate={handleLoadTemplateFromPanel}
            onDeleteTemplate={handleDeleteTemplate}
          />
        }
      />
    </SelectedAccountV2Provider>
  )
}

export { QueuePanel } from '@/components/v2/studio/QueuePanel'
export { ActivityPanel } from '@/components/v2/studio/ActivityPanel'
