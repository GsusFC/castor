'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { AppHeader } from '@/components/v2/AppHeader'
import { StudioLayout } from '@/components/v2/StudioLayout'
import { ComposerPanel, ComposerPanelRef } from '@/components/v2/ComposerPanel'
import { CalendarView } from '@/components/calendar/CalendarView'
import { SelectedAccountV2Provider } from '@/context/SelectedAccountV2Context'
import { QueuePanel } from '@/components/v2/studio/QueuePanel'
import { ActivityPanel } from '@/components/v2/studio/ActivityPanel'
import { TemplatesPanel } from '@/components/v2/studio/TemplatesPanel'
import { AccountFilterControl } from '@/components/v2/studio/AccountFilterControl'
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
type ViewModeTab = 'queue' | 'activity' | 'templates'

const DEFAULT_VIEW_MODES: Record<ViewModeTab, ViewMode> = {
  queue: 'grid',
  activity: 'grid',
  templates: 'grid',
}

export function StudioV2Client({ user, accounts, casts, templates }: StudioV2ClientProps) {
  const composerRef = useRef<ComposerPanelRef>(null)
  const [viewModes, setViewModes] = useState<Record<ViewModeTab, ViewMode>>(DEFAULT_VIEW_MODES)
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

      setViewModes({
        queue: queue === 'list' || queue === 'grid' ? queue : DEFAULT_VIEW_MODES.queue,
        activity: activity === 'list' || activity === 'grid' ? activity : DEFAULT_VIEW_MODES.activity,
        templates: templatesMode === 'list' || templatesMode === 'grid' ? templatesMode : DEFAULT_VIEW_MODES.templates,
      })
    } catch {
      setViewModes(DEFAULT_VIEW_MODES)
    }
  }, [])

  const setViewMode = (tab: ViewModeTab, mode: ViewMode) => {
    setViewModes((prev) => ({ ...prev, [tab]: mode }))
    try {
      localStorage.setItem(`studio-v2-view-mode-${tab}`, mode)
    } catch {}
  }

  return (
    <SelectedAccountV2Provider defaultAccountId={defaultAccountId}>
      <AppHeader
        user={{
          username: user.username,
          displayName: user.displayName,
          pfpUrl: user.pfpUrl,
        }}
        accounts={headerAccounts}
      />

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
          <div className="flex items-center gap-2">
            {(activeTab === 'queue' || activeTab === 'activity' || activeTab === 'templates') && (
              <div className="flex items-center rounded-md border p-0.5">
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
            )}
            <AccountFilterControl
              accountFilter={accountFilter}
              onChange={setAccountFilter}
              accounts={filterAccounts}
            />
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
            casts={upcomingCasts}
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
            casts={recentActivity}
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
            templates={studioTemplates}
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
