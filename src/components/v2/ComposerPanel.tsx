'use client'

import { useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { Pen, X } from 'lucide-react'
import { ComposeCard } from '@/components/compose/ComposeCard'
import { Channel, ReplyToCast } from '@/components/compose/types'
import type { Account } from '@/components/compose/types'
import { calculateTextLength } from '@/lib/url-utils'
import { getMaxChars, getMaxEmbeds } from '@/lib/compose'
import { useAccountsV2 } from '@/hooks/useAccountsV2'
import { useScheduleFormV2 } from '@/hooks/useScheduleFormV2'
import { useCastThread } from '@/hooks/useCastThread'
import { useComposeSubmit } from '@/hooks/useComposeSubmit'
import { useTemplates, Template } from '@/hooks/useTemplates'
import type { SerializedCast } from '@/types'
import { Button } from '@/components/ui/button'
import { formatStudioDate } from '@/lib/studio-datetime'

interface ComposerPanelProps {
  /** Accounts from the server — no client-side fetching needed */
  accounts: Account[]
  /** User's FID for auto-selecting their account */
  userFid: number
  /** Optional pre-selected account */
  defaultAccountId?: string | null
  /** Templates from the server */
  templates?: Template[]
}

/** Methods exposed to parent via ref */
export interface ComposerPanelRef {
  /** Load an existing cast into the composer for editing */
  loadCast: (cast: SerializedCast) => void
  /** Set the schedule date (from calendar day click) */
  setScheduleDate: (date: Date) => void
  /** Clear current draft/edit state and start a new cast */
  startNewCast: () => void
}

/**
 * V2 ComposerPanel — persistent side panel replacing the modal composer.
 *
 * Improvements over v1 ComposeModal:
 * - No dialog/modal wrapper — always visible as a panel
 * - Uses server-provided accounts (no 3 API calls on mount)
 * - Uses browser timezone (not hardcoded Europe/Madrid)
 * - Uses nanoid for IDs (not Math.random)
 * - Reuses ComposeCard for the actual editor UI
 * - Imperative ref for external interactions (calendar click, queue click)
 */
export const ComposerPanel = forwardRef<ComposerPanelRef, ComposerPanelProps>(
  function ComposerPanel({ accounts: serverAccounts, userFid, defaultAccountId }, ref) {
    // Map SerializedAccount to compose Account type
    const composeAccounts: Account[] = serverAccounts.map(a => ({
      id: a.id,
      fid: a.fid,
      username: a.username,
      displayName: a.displayName,
      pfpUrl: a.pfpUrl,
      isPremium: (a as unknown as { isPremium?: boolean }).isPremium,
      signerStatus: (a as unknown as { signerStatus?: string }).signerStatus,
      ownerId: (a as unknown as { ownerId?: string | null }).ownerId,
    }))

    // Hooks — v2 optimized versions
    const {
      accounts,
      selectedAccountId,
      selectedAccount,
      isLoading: isLoadingAccounts,
      setSelectedAccountId,
    } = useAccountsV2({
      accounts: composeAccounts,
      userFid,
      defaultAccountId,
    })

    const schedule = useScheduleFormV2()
    const thread = useCastThread()
    const { templates, isSaving: isSavingTemplate, saveTemplate } = useTemplates(selectedAccountId)

    // Local state
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
    const [replyTo, setReplyTo] = useState<ReplyToCast | null>(null)
    const [editCastId, setEditCastId] = useState<string | null>(null)
    const isEditMode = !!editCastId

    // Reset form
    const resetForm = useCallback(() => {
      thread.reset()
      schedule.reset()
      setSelectedChannel(null)
      setReplyTo(null)
      setEditCastId(null)
    }, [thread, schedule])

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
      loadCast: (cast: SerializedCast) => {
        // Set content
        thread.setCasts([{
          id: nanoid(),
          content: cast.content || '',
          media: cast.media?.map(m => ({
            preview: m.url,
            url: m.url,
            type: m.type as 'image' | 'video',
            uploading: false,
          })) || [],
          links: [],
        }])

        // Set schedule
        if (cast.scheduledAt) {
          schedule.setFromISO(cast.scheduledAt)
        }

        // Set channel
        if (cast.channelId) {
          setSelectedChannel({ id: cast.channelId, name: cast.channelId })
        } else {
          setSelectedChannel(null)
        }

        // Set account
        if (cast.accountId) {
          setSelectedAccountId(cast.accountId)
        }

        // Track edit mode (only for scheduled/draft — not published)
        if (cast.status === 'scheduled' || cast.status === 'draft') {
          setEditCastId(cast.id)
        } else {
          setEditCastId(null)
        }

        setReplyTo(null)
        toast.success('Cast loaded in composer')
      },

      setScheduleDate: (date: Date) => {
        // Format as YYYY-MM-DD for the date input
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        schedule.setDate(`${year}-${month}-${day}`)

        // If no time set yet, default to next hour
        if (!schedule.time) {
          const now = new Date()
          const nextHour = new Date(now.getTime() + 60 * 60 * 1000)
          const hours = String(nextHour.getHours()).padStart(2, '0')
          schedule.setTime(`${hours}:00`)
        }

        toast.success(
          `Date set to ${formatStudioDate(date, { month: 'short', day: 'numeric' })}`
        )
      },
      startNewCast: () => {
        resetForm()
        toast.success('Composer is ready for a new cast')
      },
    }), [thread, schedule, setSelectedAccountId, resetForm])

    // Submit hook
    const submit = useComposeSubmit({
      casts: thread.casts,
      selectedAccountId,
      selectedChannel,
      replyTo,
      scheduleDate: schedule.date,
      scheduleTime: schedule.time,
      scheduleToISO: schedule.toISO,
      isEditMode,
      editCastId,
      onSuccess: resetForm,
    })

    // Derived state
    const isPro = selectedAccount?.isPremium ?? false
    const maxChars = getMaxChars(isPro)
    const maxEmbeds = getMaxEmbeds(isPro)
    const hasOverChars = thread.casts.some(cast => calculateTextLength(cast.content) > maxChars)
    const hasOverEmbeds = thread.casts.some(cast => (cast.media.length + cast.links.length) > maxEmbeds)
    const hasOverLimit = hasOverChars || hasOverEmbeds
    const hasContent = thread.casts.some(cast => cast.content.trim().length > 0)

    // Template handlers
    const handleLoadTemplate = useCallback((template: Template) => {
      thread.setCasts([{
        id: nanoid(),
        content: template.content,
        media: [],
        links: [],
      }])
      if (template.channelId) {
        setSelectedChannel({ id: template.channelId, name: template.channelId })
      }
      setEditCastId(null)
      toast.success(`Template "${template.name}" loaded`)
    }, [thread])

    const handleSaveTemplate = useCallback(async () => {
      if (!hasContent) {
        toast.error('You need content to save a template')
        return
      }

      const name = prompt('Template name:')
      if (!name?.trim()) return

      const cast = thread.casts[0]
      await saveTemplate({
        name: name.trim(),
        content: cast.content,
        channelId: selectedChannel?.id,
      })
    }, [hasContent, thread.casts, selectedChannel, saveTemplate])

    return (
      <div className="flex flex-col h-full">
        {/* Panel Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
          <Pen className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {isEditMode ? 'Editing cast' : thread.isThread ? 'New Thread' : 'Composer'}
          </span>
          {isEditMode && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2 text-xs text-muted-foreground"
              onClick={resetForm}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel edit
            </Button>
          )}
        </div>

        {/* Error banner */}
        {submit.error && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 text-sm shrink-0">
            {submit.error}
          </div>
        )}

        {/* ComposeCard — reused from v1, fills the panel */}
        <ComposeCard
          className="flex-1 min-h-0 border-0 rounded-none shadow-none"
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
          isLoadingAccounts={isLoadingAccounts}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          casts={thread.casts}
          onUpdateCast={thread.updateCast}
          onAddCast={thread.addCast}
          onRemoveCast={thread.removeCast}
          scheduledDate={schedule.date}
          scheduledTime={schedule.time}
          onDateChange={schedule.setDate}
          onTimeChange={schedule.setTime}
          replyTo={replyTo}
          onSelectReplyTo={setReplyTo}
          maxChars={maxChars}
          isSubmitting={submit.isSubmitting}
          isPublishing={submit.isPublishing}
          isSavingDraft={submit.isSavingDraft}
          onSubmit={submit.handleSchedule}
          onPublishNow={submit.handlePublishNow}
          onSaveDraft={submit.handleSaveDraft}
          hasContent={hasContent}
          hasOverLimit={hasOverLimit}
          templates={templates}
          onLoadTemplate={handleLoadTemplate}
          onSaveTemplate={handleSaveTemplate}
          isSavingTemplate={isSavingTemplate}
        />
      </div>
    )
  }
)
