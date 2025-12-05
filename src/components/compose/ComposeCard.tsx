'use client'

import { Plus, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CastItem, Account, Channel, ReplyToCast } from './types'
import { calculateTextLength } from '@/lib/url-utils'
import { ScheduleDropdown } from './ScheduleDropdown'
import { AccountDropdown } from './AccountDropdown'
import { ChannelDropdown } from './ChannelDropdown'
import { TemplateDropdown } from './TemplateDropdown'
import { PreviewPopover } from './PreviewPopover'
import { CastEditorInline } from './CastEditorInline'
import { ComposeFooter } from './ComposeFooter'

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface ComposeCardProps {
  accounts: Account[]
  selectedAccountId: string | null
  onSelectAccount: (id: string) => void
  isLoadingAccounts: boolean
  selectedChannel: Channel | null
  onSelectChannel: (channel: Channel | null) => void
  casts: CastItem[]
  onUpdateCast: (index: number, cast: CastItem) => void
  onAddCast: () => void
  onRemoveCast: (index: number) => void
  scheduledDate: string
  scheduledTime: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  replyTo: ReplyToCast | null
  onSelectReplyTo: (cast: ReplyToCast | null) => void
  maxChars: number
  isSubmitting: boolean
  isSavingDraft: boolean
  onSubmit: () => void
  onSaveDraft: () => void
  hasContent: boolean
  hasOverLimit: boolean
  isEditMode?: boolean
  // Templates
  templates?: Template[]
  onLoadTemplate?: (template: Template) => void
  onSaveTemplate?: () => void
  isSavingTemplate?: boolean
}

export function ComposeCard({
  accounts,
  selectedAccountId,
  onSelectAccount,
  isLoadingAccounts,
  selectedChannel,
  onSelectChannel,
  casts,
  onUpdateCast,
  onAddCast,
  onRemoveCast,
  scheduledDate,
  scheduledTime,
  onDateChange,
  onTimeChange,
  replyTo,
  onSelectReplyTo,
  maxChars,
  isSubmitting,
  isSavingDraft,
  onSubmit,
  onSaveDraft,
  hasContent,
  hasOverLimit,
  isEditMode = false,
  templates = [],
  onLoadTemplate,
  onSaveTemplate,
  isSavingTemplate = false,
}: ComposeCardProps) {
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)
  const isThread = casts.length > 1
  const today = new Date().toISOString().split('T')[0]

  // Formatear fecha/hora para mostrar
  const getScheduleLabel = () => {
    if (!scheduledDate || !scheduledTime) return null
    const date = new Date(`${scheduledDate}T${scheduledTime}`)
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const scheduleLabel = getScheduleLabel()

  // Calcular caracteres totales
  const totalChars = casts.reduce((acc, cast) => acc + calculateTextLength(cast.content), 0)
  const currentCastChars = casts[0] ? calculateTextLength(casts[0].content) : 0

  return (
    <Card className="overflow-hidden">
      {/* Header compacto */}
      <div className="flex items-center gap-2 p-2 sm:p-3 border-b border-border bg-muted/50 flex-wrap">
        {/* Account Selector */}
        <AccountDropdown
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelect={onSelectAccount}
          isLoading={isLoadingAccounts}
        />

        {/* Channel Selector */}
        <ChannelDropdown
          selectedChannel={selectedChannel}
          onSelect={onSelectChannel}
          accountFid={selectedAccount?.fid}
        />

        {/* Schedule Selector */}
        <ScheduleDropdown
          date={scheduledDate}
          time={scheduledTime}
          onDateChange={onDateChange}
          onTimeChange={onTimeChange}
          label={scheduleLabel}
        />

        {/* Template Selector - solo si hay templates y no es modo edición */}
        {!isEditMode && templates.length > 0 && onLoadTemplate && (
          <TemplateDropdown
            templates={templates}
            onSelect={onLoadTemplate}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Preview button - solo desktop */}
        <PreviewPopover
          casts={casts}
          account={selectedAccount || null}
          channel={selectedChannel}
          replyTo={replyTo}
          hasContent={hasContent}
        />

        {/* Add to thread button - solo en modo crear */}
        {!isEditMode && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAddCast}
            disabled={!hasContent}
            className={cn(
              "h-8 w-8",
              !hasContent && "opacity-40"
            )}
            title="Añadir al thread"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}

        {/* Character count */}
        <span className={cn(
          "text-xs font-medium tabular-nums px-2",
          hasOverLimit ? "text-destructive" : "text-muted-foreground"
        )}>
          {currentCastChars}/{maxChars}
        </span>
      </div>

      {/* Reply To */}
      {replyTo && (
        <div className="flex items-start gap-3 p-3 bg-muted/50 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {replyTo.author.pfpUrl && (
                <img src={replyTo.author.pfpUrl} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-muted-foreground">
                Replying to @{replyTo.author.username}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/70 line-clamp-1">{replyTo.text}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onSelectReplyTo(null)}
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Cast Editors */}
      <div className="divide-y">
        {casts.map((cast, index) => (
          <CastEditorInline
            key={cast.id}
            cast={cast}
            index={index}
            isThread={isThread}
            maxChars={maxChars}
            onUpdate={(updatedCast) => onUpdateCast(index, updatedCast)}
            onRemove={() => onRemoveCast(index)}
          />
        ))}
      </div>

      {/* Footer */}
      <ComposeFooter
        isEditMode={isEditMode}
        isThread={isThread}
        hasContent={hasContent}
        hasOverLimit={hasOverLimit}
        selectedAccountId={selectedAccountId}
        scheduledDate={scheduledDate}
        scheduledTime={scheduledTime}
        isSubmitting={isSubmitting}
        isSavingDraft={isSavingDraft}
        isSavingTemplate={isSavingTemplate}
        onSubmit={onSubmit}
        onSaveDraft={onSaveDraft}
        onSaveTemplate={onSaveTemplate}
        casts={casts}
        onUpdateCast={onUpdateCast}
        templates={templates}
        onLoadTemplate={onLoadTemplate}
      />
    </Card>
  )
}
