'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ComposeCard } from './ComposeCard'
import { Channel, ReplyToCast, PublishNetwork } from './types'
import { toast } from 'sonner'
import { calculateTextLength, normalizeHttpUrl } from '@/lib/url-utils'
import { getMaxChars, getMaxEmbeds, parseEditCastToCastItem } from '@/lib/compose'
import type { EditCastData } from '@/lib/compose'
import {
  useAccounts,
  useTemplates,
  useScheduleForm,
  useCastThread,
  useComposeSubmit,
  Template,
} from '@/hooks'

interface ComposeModalProps {
  defaultScheduleDate?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAccountId?: string | null
  editCast?: EditCastData | null
  defaultContent?: string
  defaultEmbed?: string // URL para embeber (quote cast)
  defaultChannelId?: string | null
  defaultReplyTo?: ReplyToCast | null // Cast al que se responde
}

export function ComposeModal({
  open,
  onOpenChange,
  defaultAccountId,
  editCast,
  defaultContent,
  defaultEmbed,
  defaultChannelId,
  defaultReplyTo,
  defaultScheduleDate,
}: ComposeModalProps) {
  const router = useRouter()

  // Hooks extraídos
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    isLoading: isLoadingAccounts,
    setSelectedAccountId,
  } = useAccounts({ defaultAccountId })

  const { templates, isSaving: isSavingTemplate, saveTemplate } = useTemplates(selectedAccountId)
  const schedule = useScheduleForm()
  const thread = useCastThread()

  // Estado local
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyToCast | null>(null)
  const [selectedNetworks, setSelectedNetworks] = useState<PublishNetwork[]>(['farcaster'])
  const [availableNetworks, setAvailableNetworks] = useState<Record<PublishNetwork, boolean>>({
    farcaster: true,
    x: false,
    linkedin: false,
  })

  // Modo edición
  const isEditMode = !!editCast
  const [editCastId, setEditCastId] = useState<string | null>(null)

  // Reset form callback
  const resetForm = () => {
    thread.reset()
    schedule.reset()
    setSelectedChannel(null)
    setReplyTo(null)
    setEditCastId(null)
    setSelectedNetworks(['farcaster'])
  }

  // Hook de submit
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
    selectedNetworks,
    availableNetworks,
    onSuccess: () => {
      resetForm()
      onOpenChange(false)
    },
  })

  // Derivados
  const isPro = selectedAccount?.isPremium ?? false
  const maxChars = getMaxChars(isPro)
  const maxEmbeds = getMaxEmbeds(isPro)
  const hasOverChars = thread.casts.some(cast => calculateTextLength(cast.content) > maxChars)
  const hasOverEmbeds = thread.casts.some(cast => (cast.media.length + cast.links.length) > maxEmbeds)
  const hasOverLimit = hasOverChars || hasOverEmbeds
  const hasContent = thread.casts.some(cast => cast.content.trim().length > 0)

  // Resetear estado cuando se cierra el modal, cargar embed cuando se abre
  useEffect(() => {
    if (!open) {
      resetForm()
      submit.clearError()
    } else if (!editCast && (defaultContent || defaultEmbed || defaultReplyTo || defaultScheduleDate)) {
      // Modal se abre - cargar contenido o embed con pequeño delay
      const timeoutId = setTimeout(() => {
        thread.setCasts([{
          id: crypto.randomUUID(),
          content: defaultContent || '',
          media: [],
          links: defaultEmbed ? [{ url: normalizeHttpUrl(defaultEmbed) }] : [],
        }])
      }, 50)

      if (defaultChannelId) {
        setSelectedChannel({ id: defaultChannelId, name: defaultChannelId })
      }

      if (defaultReplyTo) {
        setReplyTo(defaultReplyTo)
      }

      if (defaultScheduleDate) {
        schedule.setDate(defaultScheduleDate)
      }

      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultContent, defaultEmbed, defaultChannelId, defaultReplyTo, defaultScheduleDate])

  // Cargar datos del cast en modo edición
  useEffect(() => {
    if (!open || !editCast) return

    setEditCastId(editCast.id)
    setSelectedAccountId(editCast.accountId)

    if (editCast.channelId) {
      setSelectedChannel({ id: editCast.channelId, name: editCast.channelId })
    }

    schedule.setFromISO(editCast.scheduledAt)

    // Usar utilidad para parsear los datos
    const castItem = parseEditCastToCastItem(editCast)
    thread.setCasts([castItem])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editCast])

  useEffect(() => {
    const loadAccountNetworks = async () => {
      if (!open || !selectedAccountId) return

      try {
        const res = await fetch('/api/integrations/typefully/social-sets')
        if (!res.ok) {
          setAvailableNetworks({ farcaster: true, x: false, linkedin: false })
          setSelectedNetworks((prev) => prev.filter((network) => network === 'farcaster'))
          return
        }

        const data = await res.json().catch(() => ({}))
        const socialSets = Array.isArray(data?.socialSets) ? data.socialSets : []
        const linked = socialSets.find((set: any) => set?.linkedAccount?.id === selectedAccountId)
        const connected = Array.isArray(linked?.connectedPlatforms) ? linked.connectedPlatforms : []

        const nextAvailability = {
          farcaster: true,
          x: connected.includes('x'),
          linkedin: connected.includes('linkedin'),
        } satisfies Record<PublishNetwork, boolean>

        setAvailableNetworks(nextAvailability)
        setSelectedNetworks((prev) => {
          const filtered = prev.filter((network) => nextAvailability[network])
          return filtered.length > 0 ? filtered : ['farcaster']
        })
      } catch {
        setAvailableNetworks({ farcaster: true, x: false, linkedin: false })
        setSelectedNetworks((prev) => prev.filter((network) => network === 'farcaster'))
      }
    }

    void loadAccountNetworks()
  }, [open, selectedAccountId])

  const handleToggleNetwork = (network: PublishNetwork) => {
    if (!availableNetworks[network]) return
    setSelectedNetworks((prev) => {
      if (prev.includes(network)) {
        const next = prev.filter((n) => n !== network)
        return next.length > 0 ? next : prev
      }
      return [...prev, network]
    })
  }

  // Cargar template
  const handleLoadTemplate = (template: Template) => {
    thread.setCasts([{
      id: Math.random().toString(36).slice(2),
      content: template.content,
      media: [],
      links: [],
    }])
    if (template.channelId) {
      setSelectedChannel({ id: template.channelId, name: template.channelId })
    }
    toast.success(`Template "${template.name}" loaded`)
  }

  // Guardar como template
  const handleSaveTemplate = async () => {
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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden flex flex-col fixed inset-0 translate-x-0 translate-y-0 rounded-none h-full md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] md:h-auto md:max-h-[90dvh] md:rounded-lg [&>button]:hidden !duration-0 !animate-none data-[state=open]:!animate-none data-[state=closed]:!animate-none">
        <DialogTitle className="sr-only">
          {isEditMode ? 'Edit Cast' : 'New Cast'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEditMode ? 'Edit your scheduled post' : 'Create and schedule a new post'}
        </DialogDescription>

        {/* Header móvil */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground -ml-2 h-8"
          >
            Cancel
          </Button>
          <span className="font-medium text-sm absolute left-1/2 -translate-x-1/2">
            {isEditMode ? 'Edit Cast' : thread.isThread ? 'New Thread' : 'New Cast'}
          </span>
          <div className="w-16" />
        </div>

        {/* Error */}
        {submit.error && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 text-sm">
            {submit.error}
          </div>
        )}

        <ComposeCard
          className="flex-1 min-h-0"
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
          selectedNetworks={selectedNetworks}
          availableNetworks={availableNetworks}
          onToggleNetwork={handleToggleNetwork}
        />
      </DialogContent>
    </Dialog>
  )
}
