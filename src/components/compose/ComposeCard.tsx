'use client'

import { X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CastItem, Account, Channel, ReplyToCast, PublishNetwork } from './types'
import { calculateTextLength } from '@/lib/url-utils'
import { ScheduleDropdown } from './ScheduleDropdown'
import { AccountDropdown } from './AccountDropdown'
import { ChannelDropdown } from './ChannelDropdown'
import { TemplateDropdown } from './TemplateDropdown'
import { CastEditorInline } from './CastEditorInline'
import { ProgressBar } from './ProgressBar'
import { ComposeFooter } from './ComposeFooter'
import { AITabs } from './AITabs'

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface ComposeCardProps {
  className?: string
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
  isPublishing: boolean
  isSavingDraft: boolean
  onSubmit: () => void
  onPublishNow: () => void
  onSaveDraft: () => void
  hasContent: boolean
  hasOverLimit: boolean
  isEditMode?: boolean
  // Templates
  templates?: Template[]
  onLoadTemplate?: (template: Template) => void
  onSaveTemplate?: () => void
  isSavingTemplate?: boolean
  selectedNetworks: PublishNetwork[]
  availableNetworks: Record<PublishNetwork, boolean>
  onToggleNetwork: (network: PublishNetwork) => void
}

export function ComposeCard({
  className,
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
  isPublishing,
  isSavingDraft,
  onSubmit,
  onPublishNow,
  onSaveDraft,
  hasContent,
  hasOverLimit,
  isEditMode = false,
  templates = [],
  onLoadTemplate,
  onSaveTemplate,
  isSavingTemplate = false,
  selectedNetworks,
  availableNetworks,
  onToggleNetwork,
}: ComposeCardProps) {
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)
  const isThread = casts.length > 1
  const hasFarcasterSelected = selectedNetworks.includes('farcaster')
  const hasOtherNetworksSelected =
    selectedNetworks.includes('x') || selectedNetworks.includes('linkedin')
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
    <Card className={cn("overflow-hidden flex flex-col h-full md:h-auto", className)}>
      {/* Header - controles principales */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        {/* Dropdowns con scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
          {/* Account Selector */}
          <AccountDropdown
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelect={onSelectAccount}
            isLoading={isLoadingAccounts}
          />

          {/* Channel Selector (Farcaster only) */}
          {hasFarcasterSelected && (
            <ChannelDropdown
              selectedChannel={selectedChannel}
              onSelect={onSelectChannel}
              accountFid={selectedAccount?.fid}
            />
          )}

          {/* Schedule Selector */}
          <ScheduleDropdown
            date={scheduledDate}
            time={scheduledTime}
            onDateChange={onDateChange}
            onTimeChange={onTimeChange}
            label={scheduleLabel}
          />
        </div>

        {/* Preview button - siempre visible */}
      </div>

      <div className="px-3 py-2 border-b border-border bg-background/60">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { id: 'farcaster', label: 'Farcaster' },
            { id: 'x', label: 'X' },
            { id: 'linkedin', label: 'LinkedIn' },
          ] as Array<{ id: PublishNetwork; label: string }>).map((network) => {
            const isEnabled = availableNetworks[network.id]
            const selected = selectedNetworks.includes(network.id)
            return (
              <button
                key={network.id}
                type="button"
                title={
                  isEnabled
                    ? `Publish to ${network.label}`
                    : network.id === 'farcaster'
                      ? ''
                      : `${network.label} is not connected for this account in Typefully`
                }
                aria-disabled={!isEnabled}
                onClick={() => {
                  if (!isEnabled) return
                  onToggleNetwork(network.id)
                }}
                className={cn(
                  'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                  !isEnabled && 'opacity-50 hover:bg-transparent'
                )}
              >
                {network.label}
              </button>
            )
          })}
          <span className="text-xs text-muted-foreground">
            Destinations: {selectedNetworks.length}
          </span>
        </div>
        {hasFarcasterSelected && hasOtherNetworksSelected && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Channel applies only to Farcaster. X/LinkedIn publish without channel targeting.
          </p>
        )}
        {!hasFarcasterSelected && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Channel targeting is only available when Farcaster is selected.
          </p>
        )}
      </div>

      {/* AI Tabs */}
      <AITabs
        currentDraft={casts[0]?.content || ''}
        onSelectText={(text) => {
          if (casts[0]) {
            onUpdateCast(0, { ...casts[0], content: text })
          }
        }}
        replyingTo={replyTo ? { 
          text: replyTo.text, 
          author: replyTo.author.username,
          pfpUrl: replyTo.author.pfpUrl ?? undefined 
        } : undefined}
        onClearReply={() => onSelectReplyTo(null)}
        maxChars={maxChars}
        accountId={selectedAccountId || undefined}
      />

      {/* Progress Bar */}
      <ProgressBar current={currentCastChars} max={maxChars} />

      {/* Cast Editors */}
      <div className="divide-y flex-1 overflow-y-auto flex flex-col">
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
        isPublishing={isPublishing}
        isSavingDraft={isSavingDraft}
        isSavingTemplate={isSavingTemplate}
        onSubmit={onSubmit}
        onPublishNow={onPublishNow}
        onSaveDraft={onSaveDraft}
        onSaveTemplate={onSaveTemplate}
        casts={casts}
        onUpdateCast={onUpdateCast}
        templates={templates}
        onLoadTemplate={onLoadTemplate}
        onAddCast={onAddCast}
      />
    </Card>
  )
}
