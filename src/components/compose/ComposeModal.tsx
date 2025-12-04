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
import { CastItem, Account, Channel, ReplyToCast } from './types'
import { toast } from 'sonner'
import { calculateTextLength } from '@/lib/url-utils'

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

const MAX_CHARS_FREE = 320
const MAX_CHARS_PREMIUM = 1024

// Convierte fecha y hora local (Europe/Madrid) a ISO string UTC
function toMadridISO(date: string, time: string): string {
  const dateTimeStr = `${date}T${time}:00`
  const madridDate = new Date(dateTimeStr + '+01:00')
  
  const testDate = new Date(dateTimeStr)
  const jan = new Date(testDate.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(testDate.getFullYear(), 6, 1).getTimezoneOffset()
  const isDST = testDate.getTimezoneOffset() < Math.max(jan, jul)
  
  if (isDST) {
    return new Date(dateTimeStr + '+02:00').toISOString()
  }
  return madridDate.toISOString()
}

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
    videoStatus?: string | null
  }[]
}

interface ComposeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAccountId?: string | null
  editCast?: EditCastData | null
}

export function ComposeModal({ open, onOpenChange, defaultAccountId, editCast }: ComposeModalProps) {
  const router = useRouter()
  
  // Estado del formulario
  const [selectedAccount, setSelectedAccount] = useState<string | null>(defaultAccountId || null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [casts, setCasts] = useState<CastItem[]>([
    { id: Math.random().toString(36).slice(2), content: '', media: [], links: [] }
  ])
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyToCast | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // Modo edición
  const isEditMode = !!editCast
  const [editCastId, setEditCastId] = useState<string | null>(null)

  // Derivados
  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const maxChars = selectedAccountData?.isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
  const isThread = casts.length > 1
  const hasOverLimit = casts.some(cast => calculateTextLength(cast.content) > maxChars)
  const hasContent = casts.some(cast => cast.content.trim().length > 0)

  // Resetear estado cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      // Limpiar estado al cerrar
      setCasts([{ id: Math.random().toString(36).slice(2), content: '', media: [], links: [] }])
      setSelectedChannel(null)
      setScheduledDate('')
      setScheduledTime('')
      setError(null)
      setReplyTo(null)
      setTemplates([])
      setEditCastId(null)
    }
  }, [open])

  // Cargar datos del cast en modo edición
  useEffect(() => {
    if (!open || !editCast) return
    
    // Precargar datos del cast
    setEditCastId(editCast.id)
    setSelectedAccount(editCast.accountId)
    
    if (editCast.channelId) {
      setSelectedChannel({ id: editCast.channelId, name: editCast.channelId })
    }
    
    // Parsear fecha y hora
    const date = new Date(editCast.scheduledAt)
    const madridDate = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
    const madridTime = date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: 'Europe/Madrid' 
    })
    setScheduledDate(madridDate)
    setScheduledTime(madridTime)
    
    // Mapear media - filtrar solo media real
    const media = (editCast.media || [])
      .filter(m => {
        const url = m.url || ''
        const isCloudflare = m.cloudflareId || 
          url.includes('cloudflare') || 
          url.includes('imagedelivery.net')
        const hasMediaExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(url)
        return isCloudflare || hasMediaExtension
      })
      .map(m => ({
        preview: m.thumbnailUrl || m.url,
        url: m.url,
        type: m.type,
        uploading: false,
        cloudflareId: m.cloudflareId || undefined,
        videoStatus: (m.videoStatus as 'pending' | 'processing' | 'ready' | 'error') || undefined,
      }))
    
    setCasts([{
      id: editCast.id,
      content: editCast.content,
      media,
      links: []
    }])
  }, [open, editCast])

  // Cargar cuentas cuando se abre el modal
  useEffect(() => {
    if (!open) return
    
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts')
        const data = await res.json()
        const approvedAccounts = data.accounts?.filter((a: Account) => a.signerStatus === 'approved') || []
        setAccounts(approvedAccounts)
        
        // Usar defaultAccountId si existe, sino la primera cuenta
        if (defaultAccountId && approvedAccounts.some((a: Account) => a.id === defaultAccountId)) {
          setSelectedAccount(defaultAccountId)
        } else if (approvedAccounts.length > 0 && !selectedAccount) {
          setSelectedAccount(approvedAccounts[0].id)
        }
      } catch (err) {
        console.error('Error loading accounts:', err)
      } finally {
        setIsLoadingAccounts(false)
      }
    }
    loadAccounts()
  }, [open, defaultAccountId])

  // Actualizar cuenta seleccionada cuando cambia defaultAccountId
  useEffect(() => {
    if (defaultAccountId && accounts.some(a => a.id === defaultAccountId)) {
      setSelectedAccount(defaultAccountId)
    }
  }, [defaultAccountId, accounts])

  // Cargar templates cuando cambia la cuenta seleccionada
  useEffect(() => {
    if (!selectedAccount) {
      setTemplates([])
      return
    }
    
    async function loadTemplates() {
      try {
        const res = await fetch(`/api/templates?accountId=${selectedAccount}`)
        const data = await res.json()
        setTemplates(data.templates || [])
      } catch (err) {
        console.error('Error loading templates:', err)
      }
    }
    loadTemplates()
  }, [selectedAccount])

  // Reset form cuando se cierra
  const resetForm = () => {
    setCasts([{ id: Math.random().toString(36).slice(2), content: '', media: [], links: [] }])
    setScheduledDate('')
    setScheduledTime('')
    setSelectedChannel(null)
    setReplyTo(null)
    setError(null)
  }

  // Acciones de casts
  const updateCast = (index: number, updatedCast: CastItem) => {
    setCasts(prev => prev.map((c, i) => i === index ? updatedCast : c))
  }

  const addCast = () => {
    setCasts(prev => [...prev, { id: Math.random().toString(36).slice(2), content: '', media: [], links: [] }])
  }

  const removeCast = (index: number) => {
    if (casts.length <= 1) return
    setCasts(prev => prev.filter((_, i) => i !== index))
  }

  // Submit
  async function handleSubmit() {
    setError(null)

    if (!selectedAccount || !hasContent || !scheduledDate || !scheduledTime) {
      return
    }

    setIsSubmitting(true)

    try {
      const scheduledAt = toMadridISO(scheduledDate, scheduledTime)
      
      const hasMediaErrors = casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      if (isThread) {
        const res = await fetch('/api/casts/schedule-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccount,
            channelId: selectedChannel?.id,
            scheduledAt,
            casts: casts.map(cast => ({
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
        const cast = casts[0]
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
        
        console.log('[ComposeModal] Submitting cast:', {
          isEditMode,
          editCastId,
          mediaCount: cast.media.length,
          mediaWithUrl: cast.media.filter(m => m.url).length,
          embeds,
        })

        // En modo edición usar PATCH, sino POST
        const url = isEditMode && editCastId 
          ? `/api/casts/${editCastId}` 
          : '/api/casts/schedule'
        const method = isEditMode && editCastId ? 'PATCH' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccount,
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
        : isThread 
          ? 'Thread programado correctamente' 
          : 'Cast programado correctamente'
      toast.success(successMsg)
      resetForm()
      onOpenChange(false)
      router.refresh() // Actualizar la lista/calendario
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Guardar como borrador
  async function handleSaveDraft() {
    setError(null)

    if (!selectedAccount) {
      toast.error('Selecciona una cuenta')
      return
    }

    setIsSavingDraft(true)

    try {
      const hasMediaErrors = casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      const cast = casts[0]
      const embeds = [
        ...cast.media.filter(m => m.url).map(m => ({ 
          url: m.url!, 
          type: m.type,
          cloudflareId: m.cloudflareId,
          videoStatus: m.videoStatus,
        })),
        ...cast.links.map(l => ({ url: l.url })),
      ]

      const scheduledAt = scheduledDate && scheduledTime 
        ? toMadridISO(scheduledDate, scheduledTime)
        : undefined

      const res = await fetch('/api/casts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount,
          content: cast.content,
          channelId: selectedChannel?.id,
          scheduledAt,
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

  // Cargar template
  const handleLoadTemplate = (template: Template) => {
    setCasts([{
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
  async function handleSaveTemplate() {
    if (!selectedAccount || !hasContent) {
      toast.error('Necesitas contenido para guardar un template')
      return
    }

    const name = prompt('Nombre del template:')
    if (!name?.trim()) return

    setIsSavingTemplate(true)
    try {
      const cast = casts[0]
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount,
          name: name.trim(),
          content: cast.content,
          channelId: selectedChannel?.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar template')

      toast.success('Template guardado')
      // Recargar templates
      const templatesRes = await fetch(`/api/templates?accountId=${selectedAccount}`)
      const templatesData = await templatesRes.json()
      setTemplates(templatesData.templates || [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg)
    } finally {
      setIsSavingTemplate(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden fixed inset-0 translate-x-0 translate-y-0 md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] md:max-h-[90vh] md:rounded-lg [&>button]:hidden">
        <DialogTitle className="sr-only">
          {isEditMode ? 'Editar Cast' : 'Nuevo Cast'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEditMode ? 'Edita tu cast programado' : 'Crea y programa un nuevo cast para Farcaster'}
        </DialogDescription>
        
        {/* Header móvil */}
        <div className="flex items-center justify-between p-3 border-b md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-gray-500"
          >
            Cancelar
          </Button>
          <span className="font-medium text-sm">
            {isEditMode ? 'Editar Cast' : isThread ? 'Nuevo Thread' : 'Nuevo Cast'}
          </span>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <ComposeCard
          accounts={accounts}
          selectedAccountId={selectedAccount}
          onSelectAccount={setSelectedAccount}
          isLoadingAccounts={isLoadingAccounts}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          casts={casts}
          onUpdateCast={updateCast}
          onAddCast={addCast}
          onRemoveCast={removeCast}
          scheduledDate={scheduledDate}
          scheduledTime={scheduledTime}
          onDateChange={setScheduledDate}
          onTimeChange={setScheduledTime}
          replyTo={replyTo}
          onSelectReplyTo={setReplyTo}
          maxChars={maxChars}
          isSubmitting={isSubmitting}
          isSavingDraft={isSavingDraft}
          onSubmit={handleSubmit}
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
