'use client'

import { useState, useRef } from 'react'
import { Brain, BarChart3, Save, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ContextEditor, type ContextEditorProps, type ContextEditorHandle } from './ContextEditor'
import { AnalyticsContent } from './AnalyticsContent'

type TabType = 'ai' | 'analytics'

interface AccountTabsProps extends Omit<ContextEditorProps, 'accountId'> {
  accountId: string
  initialTab?: TabType
}

export function AccountTabs({
  accountId,
  account,
  knowledgeBase,
  documents,
  members,
  canEdit,
  canManageMembers,
  styleProfile,
  initialTab = 'ai',
}: AccountTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const editorRef = useRef<ContextEditorHandle>(null)

  const handleSave = async () => {
    if (!editorRef.current) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await editorRef.current.save()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Tabs + Save button row */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === 'ai'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">AI Brand Mode</span>
            <span className="sm:hidden">AI</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === 'analytics'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
        </div>

        {canEdit && activeTab === 'ai' && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'ai' ? (
        <ContextEditor
          ref={editorRef}
          accountId={accountId}
          account={account}
          knowledgeBase={knowledgeBase}
          documents={documents}
          members={members}
          canEdit={canEdit}
          canManageMembers={canManageMembers}
          styleProfile={styleProfile}
        />
      ) : (
        <AnalyticsContent accountId={accountId} />
      )}
    </>
  )
}
