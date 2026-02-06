'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Calendar, List, Activity } from 'lucide-react'

type RightPanelTab = 'calendar' | 'queue' | 'activity'

const TABS = [
  { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
  { id: 'queue' as const, label: 'Queue', icon: List },
  { id: 'activity' as const, label: 'Activity', icon: Activity },
] as const

interface StudioLayoutProps {
  composerPanel: React.ReactNode
  calendarPanel: React.ReactNode
  queuePanel: React.ReactNode
  activityPanel: React.ReactNode
}

export function StudioLayout({
  composerPanel,
  calendarPanel,
  queuePanel,
  activityPanel,
}: StudioLayoutProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('calendar')

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Panel — Composer (~45%) */}
      <div className="w-[45%] min-w-[380px] max-w-[600px] border-r flex flex-col overflow-hidden">
        {composerPanel}
      </div>

      {/* Right Panel — Calendar / Queue / Activity (~55%) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
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

        {/* Tab Content */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {activeTab === 'calendar' && calendarPanel}
          {activeTab === 'queue' && queuePanel}
          {activeTab === 'activity' && activityPanel}
        </div>
      </div>
    </div>
  )
}
