'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Calendar, List, Activity, FileText } from 'lucide-react'
import { ErrorBoundary } from '@/components/v2/ErrorBoundary'

type RightPanelTab = 'calendar' | 'queue' | 'activity' | 'templates'

const TABS = [
  { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
  { id: 'queue' as const, label: 'Queue', icon: List },
  { id: 'activity' as const, label: 'Activity', icon: Activity },
  { id: 'templates' as const, label: 'Templates', icon: FileText },
] as const

interface StudioLayoutProps {
  composerPanel: React.ReactNode
  calendarPanel: React.ReactNode
  queuePanel: React.ReactNode
  activityPanel: React.ReactNode
  templatesPanel?: React.ReactNode
  rightPanelControls?: React.ReactNode
}

export function StudioLayout({
  composerPanel,
  calendarPanel,
  queuePanel,
  activityPanel,
  templatesPanel,
  rightPanelControls,
}: StudioLayoutProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('calendar')

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Left Panel — Composer (~45%) — hidden on mobile, compose via MobileNavV2 */}
      <div className="hidden lg:flex w-[45%] min-w-[380px] max-w-[600px] border-r flex-col overflow-hidden">
        <ErrorBoundary fallbackTitle="Composer failed to load">
          {composerPanel}
        </ErrorBoundary>
      </div>

      {/* Right Panel — Calendar / Queue / Activity — full width on mobile */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Tab Bar */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-1" role="tablist" aria-label="Studio right panel tabs">
          {TABS.map((tab) => {
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
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
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
          {rightPanelControls}
        </div>

        {/* Tab Content */}
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
            {activeTab === 'templates' && templatesPanel}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
