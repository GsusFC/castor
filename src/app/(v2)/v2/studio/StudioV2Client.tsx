'use client'

import { useMemo, useRef } from 'react'
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

export function StudioV2Client({ user, accounts, casts, templates }: StudioV2ClientProps) {
  const composerRef = useRef<ComposerPanelRef>(null)
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
        rightPanelControls={
          <AccountFilterControl
            accountFilter={accountFilter}
            onChange={setAccountFilter}
            accounts={filterAccounts}
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
        templatesPanel={
          <TemplatesPanel
            templates={studioTemplates}
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
