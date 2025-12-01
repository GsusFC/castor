'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { AccountSelector } from '@/components/compose/AccountSelector'
import { ChannelPicker } from '@/components/compose/ChannelPicker'
import { CastEditor } from '@/components/compose/CastEditor'
import { SchedulePicker } from '@/components/compose/SchedulePicker'
import { CastItem, Account, Channel, MediaFile } from '@/components/compose/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const MAX_CHARS_FREE = 320
const MAX_CHARS_PREMIUM = 1024

export default function EditCastPage() {
  const router = useRouter()
  const params = useParams()
  const castId = params?.id as string
  
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  
  const [casts, setCasts] = useState<CastItem[]>([
    { id: crypto.randomUUID(), content: '', media: [] }
  ])
  
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const maxChars = selectedAccountData?.isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
  const hasOverLimit = casts.some(cast => cast.content.length > maxChars)
  const hasContent = casts.some(cast => cast.content.trim().length > 0)

  // Cargar datos iniciales (cuentas y cast)
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Cargar cuentas
        const accountsRes = await fetch('/api/accounts')
        const accountsData = await accountsRes.json()
        const approvedAccounts = accountsData.accounts?.filter((a: Account) => a.signerStatus === 'approved') || []
        setAccounts(approvedAccounts)

        // 2. Cargar cast
        const castRes = await fetch(`/api/casts/${castId}`)
        if (!castRes.ok) throw new Error('Cast no encontrado')
        
        const { cast } = await castRes.json()
        
        // Rellenar estado
        setSelectedAccount(cast.accountId)
        if (cast.channelId) {
          // Aquí idealmente cargaríamos la info del canal, pero por ahora lo dejamos vacío
          // o lo simulamos si el API devolviera nombre del canal.
          // La API actual no devuelve info del canal populada, solo ID.
          // Podríamos hacer un fetch extra al canal si fuera crítico.
          setSelectedChannel({ id: cast.channelId, name: cast.channelId }) 
        }

        const date = new Date(cast.scheduledAt)
        setScheduledDate(date.toISOString().split('T')[0])
        setScheduledTime(date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }))

        // Mapear medios
        const media: MediaFile[] = cast.media?.map((m: any) => ({
          preview: m.url,
          url: m.url,
          type: m.type,
          uploading: false
        })) || []

        setCasts([{
          id: cast.id,
          content: cast.content,
          media
        }])

      } catch (err) {
        console.error('Error loading data:', err)
        setError('Error al cargar el cast')
        toast.error('Error al cargar el cast')
      } finally {
        setIsLoading(false)
      }
    }
    
    if (castId) {
      loadData()
    }
  }, [castId])

  const updateCast = (index: number, updatedCast: CastItem) => {
    setCasts(prev => prev.map((c, i) => i === index ? updatedCast : c))
  }

  // Solo permitimos 1 cast en edición por simplicidad (MVP)
  // Si es thread, solo editamos el cast principal o habría que cargar todo el thread.
  // El endpoint GET actual devuelve un cast individual.

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedAccount || !hasContent || !scheduledDate || !scheduledTime) return

    setIsSubmitting(true)

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      
      const hasMediaErrors = casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor revisa los archivos adjuntos')
      }

      const cast = casts[0]
      const embeds = cast.media.filter(m => m.url).map(m => ({ 
        url: m.url!,
        type: m.type 
      }))

      const res = await fetch(`/api/casts/${castId}`, {
        method: 'PATCH',
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
      if (!res.ok) throw new Error(data.error || 'Error al actualizar')

      toast.success('Cast actualizado correctamente')
      router.push('/dashboard/scheduled')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/scheduled">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-display text-gray-900">Editar Cast</h1>
          <p className="text-gray-500 mt-1">Modifica el contenido de tu publicación</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AccountSelector 
          accounts={accounts}
          selectedAccountId={selectedAccount}
          onSelect={setSelectedAccount}
          isLoading={false}
        />

        <ChannelPicker 
          selectedChannel={selectedChannel}
          onSelect={setSelectedChannel}
          accountFid={selectedAccountData?.fid}
        />

        <CastEditor
          cast={casts[0]}
          index={0}
          isThread={false}
          maxChars={maxChars}
          onUpdate={(updatedCast) => updateCast(0, updatedCast)}
          onRemove={() => {}}
        />

        <SchedulePicker 
          date={scheduledDate}
          time={scheduledTime}
          onDateChange={setScheduledDate}
          onTimeChange={setScheduledTime}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/scheduled">Cancelar</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !selectedAccount || !hasContent || hasOverLimit || !scheduledDate || !scheduledTime}
            className="px-6"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
