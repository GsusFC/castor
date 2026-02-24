'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Calendar, List, Activity } from 'lucide-react'
import { ErrorBoundary } from '@/components/v2/ErrorBoundary'

type RightPanelTab = 'calendar' | 'queue' | 'activity'

const LEGACY_TABS = [
  { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
  { id: 'queue' as const, label: 'Queue', icon: List },
  { id: 'activity' as const, label: 'Activity', icon: Activity },
] as const

interface StudioLayoutProps {
  composerPanel: React.ReactNode
  rightPanel?: React.ReactNode
  rightPanelControls?: React.ReactNode
  isCalendarCollapsed?: boolean
  onToggleCalendarCollapsed?: () => void
  calendarRail?: React.ReactNode
  focusAside?: React.ReactNode

  // Legacy props kept for compatibility with tests while v2 migrates.
  calendarPanel?: React.ReactNode
  queuePanel?: React.ReactNode
  activityPanel?: React.ReactNode
}

export function StudioLayout({
  composerPanel,
  rightPanel,
  rightPanelControls,
  isCalendarCollapsed = false,
  onToggleCalendarCollapsed,
  calendarRail,
  focusAside,
  calendarPanel,
  queuePanel,
  activityPanel,
}: StudioLayoutProps) {
  const hasLegacyPanels = Boolean(calendarPanel || queuePanel || activityPanel)
  const isLegacyTabbedMode = !rightPanel && hasLegacyPanels
  const canCollapseCalendar = Boolean(rightPanel) && !isLegacyTabbedMode
  const showCollapsedCalendar = canCollapseCalendar && isCalendarCollapsed
  const [activeTab, setActiveTab] = useState<RightPanelTab>('calendar')

  return (
    <div className="flex h-[100dvh] sm:h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Left Panel — Composer (~45%) — hidden on mobile, compose via MobileNavV2 */}
      {!showCollapsedCalendar && (
        <div className="hidden lg:flex w-[45%] min-w-[420px] max-w-[680px] border-r flex-col overflow-hidden">
          <ErrorBoundary fallbackTitle="Composer failed to load">
            {composerPanel}
          </ErrorBoundary>
        </div>
      )}

      {showCollapsedCalendar && (
        <div className="hidden lg:flex w-14 shrink-0 border-r bg-background/80 backdrop-blur-sm">
          <ErrorBoundary fallbackTitle="Calendar rail failed">
            <div className="flex h-full w-full flex-col items-center py-2">
              {calendarRail}
              {!calendarRail && (
                <button
                  type="button"
                  onClick={onToggleCalendarCollapsed}
                  className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Show
                </button>
              )}
            </div>
          </ErrorBoundary>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {hasLegacyPanels && rightPanel && (
          <div className="lg:hidden flex flex-col min-h-0">
            {rightPanelControls && (
              <div className="sticky top-0 z-30 px-3 sm:px-4 pt-3 pb-2 shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/60">
                {rightPanelControls}
              </div>
            )}

            <div className="flex-1 overflow-auto px-4 pb-4">
              <ErrorBoundary fallbackTitle="Panel failed to load">
                {rightPanel}
              </ErrorBoundary>
            </div>
          </div>
        )}

        {showCollapsedCalendar ? (
          <div className="hidden lg:flex h-full min-w-0">
            <div className="flex-1 min-w-0 overflow-auto px-4 py-4">
              <div className="mx-auto max-w-[760px] xl:max-w-[860px] 2xl:max-w-[940px] h-full">
                <ErrorBoundary fallbackTitle="Composer failed to load">
                  {composerPanel}
                </ErrorBoundary>
              </div>
            </div>
            <div className="w-[260px] xl:w-[280px] 2xl:w-[300px] shrink-0 border-l bg-background/60 p-3">
              <ErrorBoundary fallbackTitle="Focus tools failed">
                {focusAside ?? (
                  <div className="h-full rounded-xl border border-dashed border-border/70 bg-muted/20" />
                )}
              </ErrorBoundary>
            </div>
          </div>
        ) : isLegacyTabbedMode ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 pt-3 pb-2 shrink-0">
              <div
                className="flex items-center gap-1 overflow-x-auto no-scrollbar"
                role="tablist"
                aria-label="Studio right panel tabs"
              >
                {LEGACY_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`studio-tab-${tab.id}`}
                      aria-selected={isActive}
                      aria-controls={`studio-panel-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              {rightPanelControls && <div className="sm:ml-2">{rightPanelControls}</div>}
            </div>

            <div
              className="flex-1 overflow-auto px-4 pb-4"
              role="tabpanel"
              id={`studio-panel-${activeTab}`}
              aria-labelledby={`studio-tab-${activeTab}`}
            >
              <ErrorBoundary fallbackTitle="Panel failed to load">
                {activeTab === 'calendar' && calendarPanel}
                {activeTab === 'queue' && queuePanel}
                {activeTab === 'activity' && activityPanel}
              </ErrorBoundary>
            </div>
          </>
        ) : hasLegacyPanels ? (
          <div className="hidden lg:flex lg:flex-col min-h-0">
            <div className="sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 pt-3 pb-2 shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/60">
              <div
                className="flex items-center gap-1 overflow-x-auto no-scrollbar"
                role="tablist"
                aria-label="Studio right panel tabs"
              >
                {LEGACY_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`studio-tab-${tab.id}`}
                      aria-selected={isActive}
                      aria-controls={`studio-panel-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              {rightPanelControls && <div className="sm:ml-2">{rightPanelControls}</div>}
            </div>

            <div
              className="flex-1 overflow-auto px-4 pb-4"
              role="tabpanel"
              id={`studio-panel-${activeTab}`}
              aria-labelledby={`studio-tab-${activeTab}`}
            >
              <ErrorBoundary fallbackTitle="Panel failed to load">
                {activeTab === 'calendar' && calendarPanel}
                {activeTab === 'queue' && queuePanel}
                {activeTab === 'activity' && activityPanel}
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <>
            {rightPanelControls && (
              <div className="sticky top-0 z-30 px-3 sm:px-4 pt-3 pb-2 shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/60">
                {rightPanelControls}
              </div>
            )}

            <div className="flex-1 overflow-auto px-4 pb-4">
              <ErrorBoundary fallbackTitle="Panel failed to load">
                {rightPanel}
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
