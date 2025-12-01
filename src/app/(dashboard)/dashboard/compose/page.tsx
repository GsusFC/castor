'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Send, Save } from 'lucide-react'
import Link from 'next/link'

import { AccountSelector } from '@/components/compose/AccountSelector'
import { ChannelPicker } from '@/components/compose/ChannelPicker'
import { CastEditor } from '@/components/compose/CastEditor'
import { SchedulePicker } from '@/components/compose/SchedulePicker'
import { CastItem, Account, Channel } from '@/components/compose/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const MAX_CHARS_FREE = 320
const MAX_CHARS_PREMIUM = 1024

// Convierte fecha y hora local (Europe/Madrid) a ISO string UTC
function toMadridISO(date: string, time: string): string {
  // Crear fecha con timezone explícita de Madrid
  const dateTimeStr = `${date}T${time}:00`
  const madridDate = new Date(dateTimeStr + '+01:00') // CET offset
  
  // Ajustar por horario de verano (CEST = +02:00)
  const testDate = new Date(dateTimeStr)
  const jan = new Date(testDate.getFullYear(), 0, 1).getTimezoneOffset()
  const jul = new Date(testDate.getFullYear(), 6, 1).getTimezoneOffset()
  const isDST = testDate.getTimezoneOffset() < Math.max(jan, jul)
  
  if (isDST) {
    return new Date(dateTimeStr + '+02:00').toISOString()
  }
  return madridDate.toISOString()
}

export default function ComposePage() {
  const router = useRouter()
  
  // Estado global del formulario
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  
  const [casts, setCasts] = useState<CastItem[]>([
    { id: crypto.randomUUID(), content: '', media: [] }
  ])
  
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derivados
  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const maxChars = selectedAccountData?.isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
  const isThread = casts.length > 1
  const hasOverLimit = casts.some(cast => cast.content.length > maxChars)
  const hasContent = casts.some(cast => cast.content.trim().length > 0)

  // Cargar cuentas
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts')
        const data = await res.json()
        // Filtrar solo cuentas aprobadas (el backend ya debería hacerlo o filtramos aquí)
        const approvedAccounts = data.accounts?.filter((a: Account) => a.signerStatus === 'approved') || []
        setAccounts(approvedAccounts)
        if (approvedAccounts.length > 0) {
          setSelectedAccount(approvedAccounts[0].id)
        }
      } catch (err) {
        console.error('Error loading accounts:', err)
      } finally {
        setIsLoadingAccounts(false)
      }
    }
    loadAccounts()
  }, [])

  // Acciones de casts
  const updateCast = (index: number, updatedCast: CastItem) => {
    setCasts(prev => prev.map((c, i) => i === index ? updatedCast : c))
  }

  const addCast = () => {
    setCasts(prev => [...prev, { id: crypto.randomUUID(), content: '', media: [] }])
  }

  const removeCast = (index: number) => {
    if (casts.length <= 1) return
    setCasts(prev => prev.filter((_, i) => i !== index))
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedAccount || !hasContent || !scheduledDate || !scheduledTime) {
      return
    }

    setIsSubmitting(true)

    try {
      const scheduledAt = toMadridISO(scheduledDate, scheduledTime)
      
      // Validar que todos los media estén subidos y sin errores
      const hasMediaErrors = casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      if (isThread) {
        // Crear thread
        const res = await fetch('/api/casts/schedule-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccount,
            channelId: selectedChannel?.id,
            scheduledAt,
            casts: casts.map(cast => ({
              content: cast.content,
              embeds: cast.media.filter(m => m.url).map(m => ({ url: m.url! })),
            })),
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al programar thread')
      } else {
        // Crear cast individual
        const cast = casts[0]
        const embeds = cast.media.filter(m => m.url).map(m => ({ url: m.url! }))

        const res = await fetch('/api/casts/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccount,
            content: cast.content,
            channelId: selectedChannel?.id,
            scheduledAt,
            embeds: embeds.length > 0 ? embeds : undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al programar')
      }

      toast.success(isThread ? 'Thread programado correctamente' : 'Cast programado correctamente')
      router.push('/dashboard/scheduled')
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
      // Validar que todos los media estén subidos y sin errores
      const hasMediaErrors = casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor espera a que se suban todos los archivos o elimina los errores')
      }

      const cast = casts[0]
      const embeds = cast.media.filter(m => m.url).map(m => ({ url: m.url! }))

      // Construir scheduledAt solo si hay fecha y hora
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
      router.push('/dashboard/scheduled?tab=draft')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSavingDraft(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-display text-gray-900">
            {isThread ? 'Nuevo Thread' : 'Nuevo Cast'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isThread ? `${casts.length} casts en cadena` : 'Programa un nuevo cast'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AccountSelector 
          accounts={accounts}
          selectedAccountId={selectedAccount}
          onSelect={setSelectedAccount}
          isLoading={isLoadingAccounts}
        />

        <ChannelPicker 
          selectedChannel={selectedChannel}
          onSelect={setSelectedChannel}
          accountFid={selectedAccountData?.fid}
        />

        {/* Casts Area */}
        <div className="space-y-4">
          {casts.map((cast, index) => (
            <CastEditor
              key={cast.id}
              cast={cast}
              index={index}
              isThread={isThread}
              maxChars={maxChars}
              onUpdate={(updatedCast) => updateCast(index, updatedCast)}
              onRemove={() => removeCast(index)}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addCast}
            className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-castor-black/20 hover:text-castor-black hover:bg-gray-50 h-auto"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Añadir cast al thread
          </Button>
        </div>

        <SchedulePicker 
          date={scheduledDate}
          time={scheduledTime}
          onDateChange={setScheduledDate}
          onTimeChange={setScheduledTime}
        />

        {/* Global Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              Cancelar
            </Link>
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isSubmitting || !selectedAccount}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSavingDraft ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isSavingDraft || !selectedAccount || !hasContent || hasOverLimit || !scheduledDate || !scheduledTime}
              className="px-6"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Programando...' : isThread ? 'Programar Thread' : 'Programar Cast'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
