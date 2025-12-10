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
import { Channel, ReplyToCast, MediaFile } from './types'
import { toast } from 'sonner'
import { calculateTextLength } from '@/lib/url-utils'
import { getMaxChars, getMaxEmbeds } from '@/lib/compose/constants'
import { useAccounts, useTemplates, useScheduleForm, useCastThread, Template } from '@/hooks'

interface EditCastData {
  id: string
  content: string
  accountId: string
  channelId?: string | null
  scheduledAt: string
  media?: {
    url: string
    type: 'image' | 'video'
    thumbnailUrl?: string | null
    cloudflareId?: string | null
    livepeerAssetId?: string | null
    livepeerPlaybackId?: string | null
    videoStatus?: string | null
  }[]
}

interface ComposeModalProps {
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

  // Estado local restante
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyToCast | null>(null)

  // Modo edición
  const isEditMode = !!editCast
  const [editCastId, setEditCastId] = useState<string | null>(null)

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
      thread.reset()
      schedule.reset()
      setSelectedChannel(null)
      setError(null)
      setReplyTo(null)
      setEditCastId(null)
    } else if (!editCast && (defaultContent || defaultEmbed || defaultReplyTo)) {
      // Modal se abre - cargar contenido o embed con pequeño delay
      // para asegurar que el thread está listo
      const timeoutId = setTimeout(() => {
        thread.setCasts([{
          id: crypto.randomUUID(),
          content: defaultContent || '',
          media: [],
          links: defaultEmbed ? [{ url: defaultEmbed }] : [],
        }])
      }, 50)
      
      if (defaultChannelId) {
        setSelectedChannel({ id: defaultChannelId, name: defaultChannelId })
      }
      
      // Cargar replyTo si viene de prop
      if (defaultReplyTo) {
        setReplyTo(defaultReplyTo)
      }
      
      return () => clearTimeout(timeoutId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultContent, defaultEmbed, defaultChannelId, defaultReplyTo])

  // Cargar datos del cast en modo edición
  useEffect(() => {
    if (!open || !editCast) return

    setEditCastId(editCast.id)
    setSelectedAccountId(editCast.accountId)

    if (editCast.channelId) {
      setSelectedChannel({ id: editCast.channelId, name: editCast.channelId })
    }

    schedule.setFromISO(editCast.scheduledAt)

    // Mapear media
    const media: MediaFile[] = (editCast.media || [])
      .filter(m => {
        const url = m.url || ''
        const isCloudflare = m.cloudflareId ||
          url.includes('cloudflare') ||
          url.includes('imagedelivery.net')
        const isLivepeer = m.livepeerAssetId ||
          url.includes('livepeer') ||
          url.includes('lp-playback')
        const hasMediaExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m3u8)$/i.test(url)
        return isCloudflare || isLivepeer || hasMediaExtension
      })
      .map(m => ({
        preview: m.thumbnailUrl || m.url,
        url: m.url,
        type: m.type,
        uploading: false,
        cloudflareId: m.cloudflareId || undefined,
        livepeerAssetId: m.livepeerAssetId || undefined,
        livepeerPlaybackId: m.livepeerPlaybackId || undefined,
        videoStatus: (m.videoStatus as MediaFile['videoStatus']) || undefined,
      }))

    thread.setCasts([{
      id: editCast.id,
      content: editCast.content,
      media,
      links: [],
    }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editCast])

  // Reset form
  const resetForm = () => {
    thread.reset()
    schedule.reset()
    setSelectedChannel(null)
    setReplyTo(null)
    setError(null)
  }

  // Submit
  const handleSubmit = async () => {
    setError(null)

    if (!selectedAccountId || !hasContent || !schedule.isValid) {
      return
    }

    setIsSubmitting(true)

    try {
      const scheduledAt = schedule.toISO()
      if (!scheduledAt) throw new Error('Fecha inválida')

      const hasMediaErrors = thread.casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      if (thread.isThread) {
        const res = await fetch('/api/casts/schedule-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccountId,
            channelId: selectedChannel?.id,
            scheduledAt,
            casts: thread.casts.map(cast => ({
              content: cast.content,
              embeds: [
                ...cast.media.filter(m => m.url).map(m => ({
                  url: m.url!,
                  type: m.type,
                  cloudflareId: m.cloudflareId,
                  videoStatus: m.videoStatus,
                })),
                ...cast.links.map(l => ({ url: l.url })),
              ],
            })),
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al programar thread')
      } else {
        const cast = thread.casts[0]
        const embeds = [
          ...cast.media.filter(m => m.url).map(m => ({
            url: m.url!,
            type: m.type,
            cloudflareId: m.cloudflareId,
            livepeerAssetId: m.livepeerAssetId,
            livepeerPlaybackId: m.livepeerPlaybackId,
            videoStatus: m.videoStatus,
          })),
          ...cast.links.map(l => ({ url: l.url })),
        ]

        const url = isEditMode && editCastId
          ? `/api/casts/${editCastId}`
          : '/api/casts/schedule'
        const method = isEditMode && editCastId ? 'PATCH' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccountId,
            content: cast.content,
            channelId: selectedChannel?.id,
            scheduledAt,
            embeds: embeds.length > 0 ? embeds : undefined,
            parentHash: replyTo?.hash,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al programar')
      }

      const successMsg = isEditMode
        ? 'Cast actualizado correctamente'
        : thread.isThread
          ? 'Thread programado correctamente'
          : 'Cast programado correctamente'
      toast.success(successMsg)
      resetForm()
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Guardar como borrador
  const handleSaveDraft = async () => {
    setError(null)

    if (!selectedAccountId) {
      toast.error('Selecciona una cuenta')
      return
    }

    setIsSavingDraft(true)

    try {
      const hasMediaErrors = thread.casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      const cast = thread.casts[0]
      const embeds = [
        ...cast.media.filter(m => m.url).map(m => ({
          url: m.url!,
          type: m.type,
          cloudflareId: m.cloudflareId,
          videoStatus: m.videoStatus,
        })),
        ...cast.links.map(l => ({ url: l.url })),
      ]

      const scheduledAt = schedule.toISO()

      const res = await fetch('/api/casts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          content: cast.content,
          channelId: selectedChannel?.id,
          scheduledAt: scheduledAt || undefined, // Don't send null, send undefined so it's omitted
          embeds: embeds.length > 0 ? embeds : undefined,
          isDraft: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar borrador')

      toast.success('Borrador guardado')
      resetForm()
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSavingDraft(false)
    }
  }

  // Publicar ahora
  const handlePublishNow = async () => {
    setError(null)

    if (!selectedAccountId || !hasContent) {
      return
    }

    setIsPublishing(true)

    try {
      const hasMediaErrors = thread.casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      const cast = thread.casts[0]
      
      console.log('[Publish] Cast media:', cast.media)
      console.log('[Publish] Cast links:', cast.links)
      
      const embeds = [
        ...cast.media.filter(m => m.url).map(m => ({ url: m.url! })),
        ...cast.links.map(l => ({ url: l.url })),
      ]
      
      console.log('[Publish] Final embeds:', embeds)

      const res = await fetch('/api/casts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          content: cast.content,
          channelId: selectedChannel?.id,
          embeds: embeds.length > 0 ? embeds : undefined,
          parentHash: replyTo?.hash,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al publicar')

      toast.success('Cast publicado!')
      resetForm()
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsPublishing(false)
    }
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
    toast.success(`Template "${template.name}" cargado`)
  }

  // Guardar como template
  const handleSaveTemplate = async () => {
    if (!hasContent) {
      toast.error('Necesitas contenido para guardar un template')
      return
    }

    const name = prompt('Nombre del template:')
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
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden flex flex-col fixed inset-0 translate-x-0 translate-y-0 rounded-none h-full md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] md:h-auto md:max-h-[90vh] md:rounded-lg [&>button]:hidden">
        <DialogTitle className="sr-only">
          {isEditMode ? 'Editar Cast' : 'Nuevo Cast'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEditMode ? 'Edita tu cast programado' : 'Crea y programa un nuevo cast para Farcaster'}
        </DialogDescription>

        {/* Header móvil */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground -ml-2 h-8"
          >
            Cancelar
          </Button>
          <span className="font-medium text-sm absolute left-1/2 -translate-x-1/2">
            {isEditMode ? 'Editar Cast' : thread.isThread ? 'Nuevo Thread' : 'Nuevo Cast'}
          </span>
          <div className="w-16" />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 text-sm">
            {error}
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
          isSubmitting={isSubmitting}
          isPublishing={isPublishing}
          isSavingDraft={isSavingDraft}
          onSubmit={handleSubmit}
          onPublishNow={handlePublishNow}
          onSaveDraft={handleSaveDraft}
          hasContent={hasContent}
          hasOverLimit={hasOverLimit}
          templates={templates}
          onLoadTemplate={handleLoadTemplate}
          onSaveTemplate={handleSaveTemplate}
          isSavingTemplate={isSavingTemplate}
        />
      </DialogContent>
    </Dialog>
  )
}
