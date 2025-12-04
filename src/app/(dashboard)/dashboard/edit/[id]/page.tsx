'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { ComposeCard } from '@/components/compose/ComposeCard'
import { CastItem, Account, Channel, MediaFile } from '@/components/compose/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { calculateTextLength } from '@/lib/url-utils'

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

export default function EditCastPage() {
  const router = useRouter()
  const params = useParams()
  const castId = params?.id as string
  
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  
  const [casts, setCasts] = useState<CastItem[]>([
    { id: Math.random().toString(36).slice(2), content: '', media: [], links: [] }
  ])
  
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAccountData = accounts.find(a => a.id === selectedAccount)
  const maxChars = selectedAccountData?.isPremium ? MAX_CHARS_PREMIUM : MAX_CHARS_FREE
  const hasOverLimit = casts.some(cast => calculateTextLength(cast.content) > maxChars)
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
        
        const castData = await castRes.json()
        const cast = castData.data?.cast || castData.cast
        
        if (!cast) {
          throw new Error('Cast no encontrado en la respuesta')
        }
        
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
        // Formatear fecha en timezone Europe/Madrid para inputs
        const madridDate = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }) // en-CA da formato YYYY-MM-DD
        const madridTime = date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false,
          timeZone: 'Europe/Madrid' 
        })
        setScheduledDate(madridDate)
        setScheduledTime(madridTime)

        // Mapear medios - filtrar solo URLs que sean realmente imágenes o videos
        // Excluir URLs de links embebidos (que no tienen extensión de media o no son de cloudflare)
        const media: MediaFile[] = (cast.media || [])
          .filter((m: any) => {
            const url = m.url || ''
            // Es media real si:
            // 1. Tiene cloudflareId (subido a Cloudflare)
            // 2. Es una URL de Cloudflare Images/Stream
            // 3. Tiene extensión de imagen/video
            const isCloudflare = m.cloudflareId || 
              url.includes('cloudflare') || 
              url.includes('imagedelivery.net')
            const hasMediaExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(url)
            return isCloudflare || hasMediaExtension
          })
          .map((m: any) => ({
            preview: m.thumbnailUrl || m.url,
            url: m.url,
            type: m.type,
            uploading: false,
            cloudflareId: m.cloudflareId,
            videoStatus: m.videoStatus,
          }))

        // TODO: Cargar links existentes si el API los devuelve
        setCasts([{
          id: cast.id,
          content: cast.content,
          media,
          links: []
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

  async function handleSubmit() {
    setError(null)

    if (!selectedAccount || !hasContent || !scheduledDate || !scheduledTime) return

    setIsSubmitting(true)

    try {
      const scheduledAt = toMadridISO(scheduledDate, scheduledTime)
      
      const hasMediaErrors = casts.some(c => c.media.some(m => m.error || m.uploading))
      if (hasMediaErrors) {
        throw new Error('Por favor revisa los archivos adjuntos')
      }

      const cast = casts[0]
      const embeds = [
        ...cast.media.filter(m => m.url).map(m => ({ url: m.url! })),
        ...cast.links.map(l => ({ url: l.url })),
      ]

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
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
        </Button>
        <h1 className="text-xl font-display text-gray-900">Editar Cast</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium mb-4">
          {error}
        </div>
      )}

      <ComposeCard
        accounts={accounts}
        selectedAccountId={selectedAccount}
        onSelectAccount={setSelectedAccount}
        isLoadingAccounts={false}
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
        casts={casts}
        onUpdateCast={updateCast}
        onAddCast={() => {}} // No permitido en edición
        onRemoveCast={() => {}} // No permitido en edición
        scheduledDate={scheduledDate}
        scheduledTime={scheduledTime}
        onDateChange={setScheduledDate}
        onTimeChange={setScheduledTime}
        replyTo={null}
        onSelectReplyTo={() => {}}
        maxChars={maxChars}
        isSubmitting={isSubmitting}
        isSavingDraft={false}
        onSubmit={handleSubmit}
        onSaveDraft={() => {}} // No disponible en edición
        hasContent={hasContent}
        hasOverLimit={hasOverLimit}
        isEditMode
      />
    </div>
  )
}
