'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  User, Clock, Calendar, ExternalLink, Edit, Trash2, 
  Plus, CheckCircle, AlertCircle, List, CalendarDays,
  FileText, LayoutTemplate, ChevronDown, Image, Video
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CalendarView } from '@/components/calendar/CalendarView'
import { AddAccountButton } from './accounts/add-account-button'
import { toast } from 'sonner'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { ComposeModal } from '@/components/compose/ComposeModal'

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

interface CastMedia {
  id: string
  url: string
  type: 'image' | 'video'
  thumbnailUrl: string | null
  cloudflareId?: string | null
  videoStatus?: string | null
}

interface EditCastData {
  id: string
  content: string
  accountId: string
  channelId?: string | null
  scheduledAt: string
  media?: CastMedia[]
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
  media: CastMedia[]
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

type Tab = 'scheduled' | 'published'
type ViewMode = 'list' | 'calendar'

export function UnifiedDashboard({ 
  accounts, 
  casts, 
  templates,
  currentUserId,
  isAdmin 
}: UnifiedDashboardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount()
  
  // Ordenar cuentas: personales primero, luego business
  const sortedAccounts = [...accounts].sort((a, b) => {
    // Personales primero
    if (a.type === 'personal' && b.type !== 'personal') return -1
    if (a.type !== 'personal' && b.type === 'personal') return 1
    return 0
  })
  
  // Seleccionar la primera cuenta aprobada por defecto (solo si no hay ninguna seleccionada)
  const firstApprovedAccount = sortedAccounts.find(a => a.signerStatus === 'approved')
  useEffect(() => {
    if (selectedAccountId === null && firstApprovedAccount) {
      setSelectedAccountId(firstApprovedAccount.id)
    }
  }, [selectedAccountId, firstApprovedAccount, setSelectedAccountId])

  const [activeTab, setActiveTab] = useState<Tab>('scheduled')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showAllCasts, setShowAllCasts] = useState(false)
  
  // Estado para modal de edición
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editCast, setEditCast] = useState<EditCastData | null>(null)

  const handleEditCast = useCallback((cast: Cast) => {
    setEditCast({
      id: cast.id,
      content: cast.content,
      accountId: cast.accountId,
      channelId: cast.channelId,
      scheduledAt: cast.scheduledAt,
      media: cast.media,
    })
    setEditModalOpen(true)
  }, [])

  // Abrir modal si hay parámetro edit en la URL
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      const castToEdit = casts.find(c => c.id === editId)
      if (castToEdit) {
        handleEditCast(castToEdit)
        // Limpiar el parámetro de la URL
        router.replace('/dashboard', { scroll: false })
      }
    }
  }, [searchParams, casts, handleEditCast, router])

  // Auto-refresh cada 30s si hay casts programados
  const scheduledCasts = casts.filter(c => c.status === 'scheduled')
  useEffect(() => {
    if (scheduledCasts.length === 0) return
    const timer = setInterval(() => router.refresh(), 30000)
    return () => clearInterval(timer)
  }, [router, scheduledCasts.length])

  // Filtrar datos según cuenta seleccionada (o mostrar todos si showAllCasts)
  const filteredCasts = showAllCasts 
    ? casts 
    : selectedAccountId 
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
      console.log('[Delete] Deleting cast:', castId)
      const res = await fetch(`/api/casts/${castId}`, { method: 'DELETE' })
      
      if (!res.ok) {
        const text = await res.text()
        console.error('[Delete] Error response:', res.status, text)
        throw new Error(`Error ${res.status}`)
      }
      
      const data = await res.json()
      console.log('[Delete] Success:', data)
      toast.success('Cast eliminado')
      router.refresh()
    } catch (error) {
      console.error('[Delete] Error:', error)
      toast.error('Error al eliminar cast')
    }
  }

  // Render content based on tab
  const renderContent = () => {
    // Si showAllCasts, mostrar todos los casts de todas las cuentas
    const castsToShow = showAllCasts 
      ? casts 
      : activeTab === 'scheduled' 
        ? scheduled 
        : published

    if (viewMode === 'calendar') {
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
            <List className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500">No hay casts</p>
        </Card>
      )
    }

    return (
      <div className="space-y-3">
        {castsToShow.map(cast => (
          <CastCard 
            key={cast.id} 
            cast={cast} 
            onEdit={() => handleEditCast(cast)}
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

      {/* Tabs principales + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-lg border border-gray-200/50">
          <TabButton 
            active={activeTab === 'scheduled' && !showAllCasts} 
            onClick={() => {
              setActiveTab('scheduled')
              setShowAllCasts(false)
            }}
            count={scheduled.length}
          >
            <Clock className="w-3.5 h-3.5" />
            Programados
          </TabButton>
          <TabButton 
            active={activeTab === 'published' && !showAllCasts} 
            onClick={() => {
              setActiveTab('published')
              setShowAllCasts(false)
            }}
            count={published.length}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Publicados
          </TabButton>
          {isAdmin && (
            <TabButton 
              active={showAllCasts} 
              onClick={() => setShowAllCasts(true)}
              count={casts.length}
            >
              <List className="w-3.5 h-3.5" />
              Todos
            </TabButton>
          )}
        </div>

        {/* View toggle */}
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
      </div>

      {/* Content principal */}
      {renderContent()}

      {/* Sección de Recursos */}
      <section className="pt-6 border-t">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Recursos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Borradores */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Borradores</h3>
                  <p className="text-xs text-gray-500">{drafts.length} guardados</p>
                </div>
              </div>
            </div>
            {drafts.length > 0 ? (
              <div className="space-y-2">
                {drafts.slice(0, 3).map(draft => (
                  <div 
                    key={draft.id} 
                    className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.href = `/dashboard/edit/${draft.id}`}
                  >
                    <p className="text-sm text-gray-600 truncate flex-1">
                      {draft.content || <span className="italic text-gray-400">Sin contenido</span>}
                    </p>
                    <Edit className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
                {drafts.length > 3 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{drafts.length - 3} más
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No hay borradores</p>
            )}
          </Card>

          {/* Templates */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <LayoutTemplate className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Templates</h3>
                  <p className="text-xs text-gray-500">{filteredTemplates.length} disponibles</p>
                </div>
              </div>
            </div>
            {filteredTemplates.length > 0 ? (
              <div className="space-y-2">
                {filteredTemplates.slice(0, 3).map(template => (
                  <div 
                    key={template.id} 
                    className="group flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{template.name}</p>
                      <p className="text-xs text-gray-400 truncate">{template.content}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTemplate(template.id)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {filteredTemplates.length > 3 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{filteredTemplates.length - 3} más
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                {selectedAccountId ? 'No hay templates' : 'Selecciona una cuenta'}
              </p>
            )}
          </Card>
        </div>
      </section>

      {/* Modal de edición */}
      <ComposeModal 
        open={editModalOpen} 
        onOpenChange={(open) => {
          setEditModalOpen(open)
          if (!open) setEditCast(null)
        }}
        editCast={editCast}
        defaultAccountId={editCast?.accountId}
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
  isDraft = false,
  onEdit,
  onDelete 
}: { 
  cast: Cast
  isDraft?: boolean
  onEdit?: () => void
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
      "overflow-hidden transition-all group",
      isDraft && "border-amber-200 bg-amber-50/30"
    )}>
      {/* Vista colapsada - siempre visible */}
      <div className="w-full p-3 flex items-center gap-3 text-left hover:bg-gray-50/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
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
                  {' '}
                  {scheduledDate.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
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
            {cast.media.length > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  {cast.media.some(m => m.type === 'video') ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <Image className="w-3 h-3" />
                  )}
                  {cast.media.length}
                </span>
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

        {/* Acciones en hover (solo si no está publicado) */}
        {cast.status !== 'published' && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                onEdit?.()
              }}
              title="Editar"
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        <ChevronDown className={cn(
          "w-4 h-4 text-gray-400 transition-transform flex-shrink-0",
          expanded && "rotate-180"
        )} />
      </div>

      {/* Vista expandida */}
      {expanded && (
        <div className="px-3 pb-3 border-t bg-gray-50/30">
          <p className="text-sm text-gray-900 leading-relaxed py-3 whitespace-pre-wrap">
            {cast.content}
          </p>

          {/* Media preview */}
          {cast.media.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              {cast.media.map((m) => (
                <div key={m.id} className="flex-shrink-0 relative">
                  {m.type === 'video' ? (
                    <div className="w-24 h-24 bg-gray-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                      {m.thumbnailUrl ? (
                        <img 
                          src={m.thumbnailUrl} 
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={m.url} 
                      alt="Media"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Link a Warpcast en vista expandida */}
          {cast.status === 'published' && cast.castHash && (
            <a
              href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              Ver en Warpcast
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  )
}

