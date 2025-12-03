'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  User, Clock, Calendar, ExternalLink, Edit, Trash2, 
  Plus, CheckCircle, AlertCircle, List, CalendarDays,
  FileText, LayoutTemplate, ChevronDown
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CalendarView } from '@/components/calendar/CalendarView'
import { AddAccountButton } from './accounts/add-account-button'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { toast } from 'sonner'

// Types
interface AccountOwner {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

interface Account {
  id: string
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
  signerStatus: string
  type: string
  isPremium: boolean
  isShared: boolean
  ownerId: string | null
  owner: AccountOwner | null
}

interface Cast {
  id: string
  content: string
  status: string
  scheduledAt: string
  publishedAt: string | null
  castHash: string | null
  channelId: string | null
  accountId: string
  account: {
    id: string
    username: string
    displayName: string | null
    pfpUrl: string | null
  } | null
  createdBy: AccountOwner | null
}

interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface UnifiedDashboardProps {
  accounts: Account[]
  casts: Cast[]
  templates: Template[]
  currentUserId: string
  isAdmin: boolean
}

type Tab = 'scheduled' | 'drafts' | 'published' | 'templates'
type ViewMode = 'list' | 'calendar'

export function UnifiedDashboard({ 
  accounts, 
  casts, 
  templates,
  currentUserId,
  isAdmin 
}: UnifiedDashboardProps) {
  const router = useRouter()
  
  // Ordenar cuentas: personales primero, luego business
  const sortedAccounts = [...accounts].sort((a, b) => {
    // Personales primero
    if (a.type === 'personal' && b.type !== 'personal') return -1
    if (a.type !== 'personal' && b.type === 'personal') return 1
    return 0
  })
  
  // Seleccionar la primera cuenta aprobada por defecto (no "Todas")
  const firstApprovedAccount = sortedAccounts.find(a => a.signerStatus === 'approved')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    firstApprovedAccount?.id || null
  )
  const [activeTab, setActiveTab] = useState<Tab>('scheduled')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [composeOpen, setComposeOpen] = useState(false)

  // Auto-refresh cada 30s si hay casts programados
  const scheduledCasts = casts.filter(c => c.status === 'scheduled')
  useEffect(() => {
    if (scheduledCasts.length === 0) return
    const timer = setInterval(() => router.refresh(), 30000)
    return () => clearInterval(timer)
  }, [router, scheduledCasts.length])

  // Filtrar datos según cuenta seleccionada
  const filteredCasts = selectedAccountId 
    ? casts.filter(c => c.accountId === selectedAccountId)
    : casts

  const filteredTemplates = selectedAccountId
    ? templates.filter(t => t.accountId === selectedAccountId)
    : templates

  const scheduled = filteredCasts.filter(c => c.status === 'scheduled')
  const drafts = filteredCasts.filter(c => c.status === 'draft')
  const published = filteredCasts.filter(c => c.status === 'published')

  // Handlers
  const handleMoveCast = async (castId: string, newDate: Date) => {
    try {
      const res = await fetch(`/api/casts/${castId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      })
      if (!res.ok) throw new Error('Failed to update cast')
      router.refresh()
    } catch (error) {
      console.error('Error moving cast:', error)
      toast.error('Error al mover el cast')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('¿Eliminar este template?')) return
    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Template eliminado')
      router.refresh()
    } catch (error) {
      toast.error('Error al eliminar template')
    }
  }

  const handleDeleteCast = async (castId: string) => {
    if (!confirm('¿Eliminar este cast?')) return
    try {
      const res = await fetch(`/api/casts/${castId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Cast eliminado')
      router.refresh()
    } catch (error) {
      toast.error('Error al eliminar cast')
    }
  }

  // Render content based on tab
  const renderContent = () => {
    if (activeTab === 'templates') {
      return (
        <TemplatesGrid 
          templates={filteredTemplates} 
          onDelete={handleDeleteTemplate}
          selectedAccountId={selectedAccountId}
        />
      )
    }

    const castsToShow = activeTab === 'scheduled' 
      ? scheduled 
      : activeTab === 'published' 
        ? published 
        : drafts

    if (viewMode === 'calendar' && (activeTab === 'scheduled' || activeTab === 'published')) {
      const calendarCasts = castsToShow.map(c => ({
        ...c,
        scheduledAt: new Date(c.scheduledAt),
      }))
      return (
        <Card className="p-4">
          <CalendarView casts={calendarCasts} onMoveCast={handleMoveCast} />
        </Card>
      )
    }

    if (castsToShow.length === 0) {
      return (
        <Card className="p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {activeTab === 'scheduled' ? (
              <Clock className="w-6 h-6 text-gray-400" />
            ) : activeTab === 'published' ? (
              <CheckCircle className="w-6 h-6 text-gray-400" />
            ) : (
              <FileText className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <p className="text-gray-500">
            {activeTab === 'scheduled' 
              ? 'No hay casts programados' 
              : activeTab === 'published'
                ? 'No hay casts publicados'
                : 'No hay borradores'}
          </p>
        </Card>
      )
    }

    return (
      <div className="space-y-3">
        {castsToShow.map(cast => (
          <CastCard 
            key={cast.id} 
            cast={cast} 
            isDraft={activeTab === 'drafts'}
            onDelete={() => handleDeleteCast(cast.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Módulo de Cuentas */}
      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-3">Cuentas</h2>
        <div className="flex flex-wrap gap-2">
          {sortedAccounts.map(account => {
            const accountCastsCount = casts.filter(c => c.accountId === account.id).length
            const isSelected = selectedAccountId === account.id
            const isPending = account.signerStatus === 'pending'
            
            return (
              <button
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                  isSelected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : isPending
                      ? "border-amber-200 bg-amber-50 text-amber-700 cursor-not-allowed"
                      : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                {account.pfpUrl ? (
                  <img 
                    src={account.pfpUrl} 
                    alt="" 
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                <span>@{account.username}</span>
                {isPending ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <span className="text-xs opacity-70">({accountCastsCount})</span>
                )}
              </button>
            )
          })}

          {/* Opción "Todas" al final */}
          <button
            onClick={() => setSelectedAccountId(null)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
              !selectedAccountId
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <span>Todas</span>
            <span className="text-xs opacity-70">({casts.length})</span>
          </button>

          {/* Botón añadir cuenta */}
          <AddAccountButton variant="icon" />
        </div>
      </section>

      {/* Tabs + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-lg border border-gray-200/50">
          <TabButton 
            active={activeTab === 'scheduled'} 
            onClick={() => setActiveTab('scheduled')}
            count={scheduled.length}
          >
            <Clock className="w-3.5 h-3.5" />
            Programados
          </TabButton>
          <TabButton 
            active={activeTab === 'published'} 
            onClick={() => setActiveTab('published')}
            count={published.length}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Publicados
          </TabButton>
          <TabButton 
            active={activeTab === 'drafts'} 
            onClick={() => setActiveTab('drafts')}
            count={drafts.length}
          >
            <FileText className="w-3.5 h-3.5" />
            Borradores
          </TabButton>
          <TabButton 
            active={activeTab === 'templates'} 
            onClick={() => setActiveTab('templates')}
            count={filteredTemplates.length}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Templates
          </TabButton>
        </div>

        {/* View toggle - para scheduled y published */}
        {(activeTab === 'scheduled' || activeTab === 'published') && (
          <div className="flex items-center bg-gray-100/50 p-1 rounded-lg border border-gray-200/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn(
                "h-7 text-xs",
                viewMode === 'list' && "bg-white shadow-sm"
              )}
            >
              <List className="w-3.5 h-3.5 mr-1.5" />
              Lista
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('calendar')}
              className={cn(
                "h-7 text-xs",
                viewMode === 'calendar' && "bg-white shadow-sm"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
              Calendario
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {renderContent()}

      {/* Botón flotante Nuevo Cast */}
      <Button
        onClick={() => setComposeOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:h-auto md:w-auto md:px-6 md:rounded-lg"
      >
        <Plus className="w-6 h-6 md:w-4 md:h-4 md:mr-2" />
        <span className="hidden md:inline">Nuevo Cast</span>
      </Button>

      {/* Modal de compose */}
      <ComposeModal 
        open={composeOpen} 
        onOpenChange={setComposeOpen}
        defaultAccountId={selectedAccountId}
      />
    </div>
  )
}

// Sub-components
function TabButton({ 
  children, 
  active, 
  onClick, 
  count 
}: { 
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
        active 
          ? "bg-white shadow-sm text-gray-900" 
          : "text-gray-500 hover:text-gray-700"
      )}
    >
      {children}
      <span className={cn(
        "ml-1 px-1.5 py-0.5 rounded text-[10px]",
        active ? "bg-gray-100" : "bg-gray-200/50"
      )}>
        {count}
      </span>
    </button>
  )
}

function CastCard({ 
  cast, 
  isDraft,
  onDelete 
}: { 
  cast: Cast
  isDraft: boolean
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const scheduledDate = new Date(cast.scheduledAt)
  
  const statusStyles: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
    publishing: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    published: 'bg-green-50 text-green-700 border-green-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
    draft: 'bg-amber-50 text-amber-700 border-amber-100',
  }

  const statusLabels: Record<string, string> = {
    scheduled: 'Programado',
    publishing: 'Publicando',
    published: 'Publicado',
    failed: 'Fallido',
    draft: 'Borrador',
  }

  // Truncar contenido para vista colapsada
  const truncatedContent = cast.content.length > 80 
    ? cast.content.slice(0, 80) + '...' 
    : cast.content

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      isDraft && "border-amber-200 bg-amber-50/30"
    )}>
      {/* Vista colapsada - siempre visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        {cast.account?.pfpUrl ? (
          <img
            src={cast.account.pfpUrl}
            alt={cast.account.username}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-400" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">
            {cast.content || <span className="text-gray-400 italic">Sin contenido</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>@{cast.account?.username}</span>
            {!isDraft && (
              <>
                <span>·</span>
                <span>
                  {scheduledDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'Europe/Madrid',
                  })}
                </span>
              </>
            )}
            {cast.channelId && (
              <>
                <span>·</span>
                <span className="text-purple-600">#{cast.channelId}</span>
              </>
            )}
          </div>
        </div>

        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0",
          statusStyles[cast.status] || 'bg-gray-50 text-gray-600 border-gray-100'
        )}>
          {statusLabels[cast.status] || cast.status}
        </span>

        {/* Link a Warpcast en vista colapsada */}
        {cast.status === 'published' && cast.castHash && (
          <a
            href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-400 hover:text-gray-900 p-1"
            onClick={(e) => e.stopPropagation()}
            title="Ver en Warpcast"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <ChevronDown className={cn(
          "w-4 h-4 text-gray-400 transition-transform flex-shrink-0",
          expanded && "rotate-180"
        )} />
      </button>

      {/* Vista expandida */}
      {expanded && (
        <div className="px-3 pb-3 border-t bg-gray-50/30">
          <p className="text-sm text-gray-900 leading-relaxed py-3 whitespace-pre-wrap">
            {cast.content}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {!isDraft && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {scheduledDate.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Madrid',
                  })}
                </div>
              )}
              {cast.status === 'published' && cast.castHash && (
                <a
                  href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ver en Warpcast
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Solo mostrar acciones si NO está publicado */}
            {cast.status !== 'published' && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/dashboard/edit/${cast.id}`} onClick={(e) => e.stopPropagation()}>
                    <Edit className="w-3 h-3 mr-1" />
                    Editar
                  </Link>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function TemplatesGrid({ 
  templates, 
  onDelete,
  selectedAccountId 
}: { 
  templates: Template[]
  onDelete: (id: string) => void
  selectedAccountId: string | null
}) {
  if (templates.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <LayoutTemplate className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-2">No hay templates</p>
        <p className="text-xs text-gray-400">
          {selectedAccountId 
            ? 'Crea un template desde el modal de nuevo cast'
            : 'Selecciona una cuenta para ver sus templates'}
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map(template => (
        <Card key={template.id} className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-sm">{template.name}</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-gray-400 hover:text-red-500"
              onClick={() => onDelete(template.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 line-clamp-3 mb-3">
            {template.content}
          </p>
          {template.channelId && (
            <span className="text-xs text-purple-600">#{template.channelId}</span>
          )}
        </Card>
      ))}
    </div>
  )
}
