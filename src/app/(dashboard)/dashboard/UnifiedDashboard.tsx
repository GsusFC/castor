'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  userFid: number
  isAdmin: boolean
}

type Tab = 'scheduled' | 'published'
type ViewMode = 'list' | 'calendar'

export function UnifiedDashboard({ 
  accounts, 
  casts, 
  templates,
  currentUserId,
  userFid,
  isAdmin 
}: UnifiedDashboardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount()
  
  // Ordenar cuentas: cuenta del usuario primero (mismo FID), luego el resto
  const sortedAccounts = [...accounts].sort((a, b) => {
    // Cuenta del usuario primero
    const aIsUser = a.fid === userFid
    const bIsUser = b.fid === userFid
    if (aIsUser && !bIsUser) return -1
    if (!aIsUser && bIsUser) return 1
    return 0
  })
  
  // Seleccionar la primera cuenta aprobada por defecto (solo al montar, no cuando el usuario elige "All")
  const firstApprovedAccount = sortedAccounts.find(a => a.signerStatus === 'approved')
  const hasInitialized = React.useRef(false)
  useEffect(() => {
    // Solo auto-seleccionar una vez al montar si no hay cuenta en localStorage
    if (!hasInitialized.current && selectedAccountId === null && firstApprovedAccount) {
      setSelectedAccountId(firstApprovedAccount.id)
    }
    hasInitialized.current = true
  }, [selectedAccountId, firstApprovedAccount, setSelectedAccountId])

  const [activeTab, setActiveTab] = useState<Tab>('scheduled')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showAllCasts, setShowAllCasts] = useState(false)
  
  // Estado para modal de edición
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editCast, setEditCast] = useState<EditCastData | null>(null)
  
  // Estado para crear cast desde template
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateContent, setTemplateContent] = useState<{ content: string; channelId: string | null } | null>(null)

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

  // Auto-refresh inteligente: más frecuente cuando hay casts próximos a publicarse
  const scheduledCasts = casts.filter(c => c.status === 'scheduled')
  useEffect(() => {
    if (scheduledCasts.length === 0) return
    
    const checkAndRefresh = () => {
      const now = new Date()
      const hasUpcomingCast = scheduledCasts.some(cast => {
        const scheduledTime = new Date(cast.scheduledAt)
        const diffMs = scheduledTime.getTime() - now.getTime()
        // Cast programado en los próximos 2 minutos o ya pasó
        return diffMs <= 2 * 60 * 1000
      })
      
      if (hasUpcomingCast) {
        router.refresh()
      }
    }
    
    // Check cada 15 segundos
    const timer = setInterval(checkAndRefresh, 15000)
    // Check inmediato también
    checkAndRefresh()
    
    return () => clearInterval(timer)
  }, [router, scheduledCasts])

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

    // Calendario solo en desktop (sm+)
    if (viewMode === 'calendar') {
      const calendarCasts = castsToShow.map(c => ({
        ...c,
        scheduledAt: new Date(c.scheduledAt),
      }))
      return (
        <>
          {/* Calendario en desktop */}
          <Card className="p-4 hidden sm:block">
            <CalendarView casts={calendarCasts} onMoveCast={handleMoveCast} />
          </Card>
          {/* Lista en móvil como fallback */}
          <div className="space-y-3 sm:hidden">
            {castsToShow.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <List className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No casts</p>
              </Card>
            ) : (
              castsToShow.map(cast => (
                <CastCard 
                  key={cast.id} 
                  cast={cast} 
                  onEdit={() => handleEditCast(cast)}
                  onDelete={() => handleDeleteCast(cast.id)}
                />
              ))
            )}
          </div>
        </>
      )
    }

    if (castsToShow.length === 0) {
      return (
        <Card className="p-12 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <List className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No casts</p>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Accounts</h2>
          <Link 
            href="/dashboard/accounts" 
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mb-2 sm:flex-wrap sm:overflow-visible">
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
                  "flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-2 rounded-lg border transition-all text-sm flex-shrink-0",
                  isSelected
                    ? "border-foreground/20 bg-muted text-foreground font-medium"
                    : isPending
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 cursor-not-allowed dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400"
                      : "border-border bg-card hover:border-foreground/30 text-muted-foreground hover:text-foreground"
                )}
                title={`@${account.username} (${accountCastsCount})`}
              >
                {account.pfpUrl ? (
                  <img 
                    src={account.pfpUrl} 
                    alt={account.username} 
                    className="w-7 h-7 sm:w-5 sm:h-5 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-5 sm:h-5 bg-muted rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 sm:w-3 sm:h-3 text-muted-foreground" />
                  </div>
                )}
                <span className="hidden sm:inline">@{account.username}</span>
                {isPending ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <span className="hidden sm:inline text-xs opacity-70">({accountCastsCount})</span>
                )}
              </button>
            )
          })}

          {/* Opción "Todas" al final */}
          <button
            onClick={() => setSelectedAccountId(null)}
            className={cn(
              "flex items-center justify-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-2 rounded-lg border transition-all text-sm flex-shrink-0 min-w-[40px] sm:min-w-0",
              !selectedAccountId
                ? "border-foreground/20 bg-muted text-foreground font-medium"
                : "border-border bg-card hover:border-foreground/30 text-muted-foreground hover:text-foreground"
            )}
            title={`All (${casts.length})`}
          >
            <span className="text-xs sm:text-sm font-medium">All</span>
            <span className="hidden sm:inline text-xs opacity-70">({casts.length})</span>
          </button>

          {/* Botón añadir cuenta */}
          <AddAccountButton variant="icon" />
        </div>
      </section>

      {/* Tabs principales + View Toggle */}
      <div className="flex items-center justify-between gap-2">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
          <TabButton 
            active={activeTab === 'scheduled' && !showAllCasts} 
            onClick={() => {
              setActiveTab('scheduled')
              setShowAllCasts(false)
            }}
            count={scheduled.length}
          >
            <Clock className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Scheduled</span>
          </TabButton>
          <TabButton 
            active={activeTab === 'published' && !showAllCasts} 
            onClick={() => {
              setActiveTab('published')
              setShowAllCasts(false)
            }}
            count={published.length}
          >
            <CheckCircle className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Published</span>
          </TabButton>
          {isAdmin && (
            <TabButton 
              active={showAllCasts} 
              onClick={() => setShowAllCasts(true)}
              count={casts.length}
            >
              <List className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">All</span>
            </TabButton>
          )}
        </div>

        {/* View toggle - solo visible en desktop */}
        <div className="hidden sm:flex items-center bg-muted/50 p-1 rounded-lg border border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn(
              "h-8 px-3",
              viewMode === 'list' && "bg-card shadow-sm"
            )}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
            <span className="ml-1.5 text-xs">List</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('calendar')}
            className={cn(
              "h-8 px-3",
              viewMode === 'calendar' && "bg-card shadow-sm"
            )}
            aria-label="Calendar view"
          >
            <CalendarDays className="w-4 h-4" />
            <span className="ml-1.5 text-xs">Calendar</span>
          </Button>
        </div>
      </div>

      {/* Content principal */}
      {renderContent()}

      {/* Sección de Recursos - oculta en móvil (accesible desde footer) */}
      <section className="hidden sm:block pt-6 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Borradores */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Drafts</h3>
                  <p className="text-xs text-muted-foreground">{drafts.length} saved</p>
                </div>
              </div>
            </div>
            {drafts.length > 0 ? (
              <div className="space-y-2">
                {drafts.slice(0, 3).map(draft => (
                  <div 
                    key={draft.id} 
                    className="group flex items-center gap-2 p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => router.push(`/dashboard?edit=${draft.id}`)}
                  >
                    <p className="text-sm text-foreground truncate flex-1">
                      {draft.content || <span className="italic text-muted-foreground">No content</span>}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCast(draft.id)
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
                {drafts.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{drafts.length - 3} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No drafts</p>
            )}
          </Card>

          {/* Templates */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-950 rounded-lg flex items-center justify-center">
                  <LayoutTemplate className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Templates</h3>
                  <p className="text-xs text-muted-foreground">{filteredTemplates.length} available</p>
                </div>
              </div>
            </div>
            {filteredTemplates.length > 0 ? (
              <div className="space-y-2">
                {filteredTemplates.slice(0, 3).map(template => (
                  <div 
                    key={template.id} 
                    className="group flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => {
                      setTemplateContent({ content: template.content, channelId: template.channelId })
                      setTemplateModalOpen(true)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{template.content}</p>
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
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{filteredTemplates.length - 3} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {selectedAccountId ? 'No templates' : 'Select an account'}
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

      {/* Modal para crear desde template */}
      <ComposeModal 
        open={templateModalOpen} 
        onOpenChange={(open) => {
          setTemplateModalOpen(open)
          if (!open) setTemplateContent(null)
        }}
        defaultAccountId={selectedAccountId}
        defaultContent={templateContent?.content}
        defaultChannelId={templateContent?.channelId}
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
        "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all",
        active 
          ? "bg-card shadow-sm text-foreground" 
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      <span className={cn(
        "px-1.5 py-0.5 rounded text-[10px]",
        active ? "bg-muted" : "bg-muted/50"
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
    scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
    publishing: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
    published: 'bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
    failed: 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
    draft: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  }

  const statusLabels: Record<string, string> = {
    scheduled: 'Scheduled',
    publishing: 'Publishing',
    published: 'Published',
    failed: 'Failed',
    draft: 'Draft',
  }

  // Truncar contenido para vista colapsada
  const truncatedContent = cast.content.length > 80 
    ? cast.content.slice(0, 80) + '...' 
    : cast.content

  return (
    <Card className={cn(
      "overflow-hidden transition-all group",
      isDraft && "border-amber-500/30 bg-amber-500/10 dark:border-amber-500/40 dark:bg-amber-500/20"
    )}>
      {/* Vista colapsada - siempre visible */}
      <div className="w-full p-3 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {cast.account?.pfpUrl ? (
          <img
            src={cast.account.pfpUrl}
            alt={cast.account.username}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">
            {cast.content || <span className="text-muted-foreground italic">No content</span>}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 overflow-hidden">
            {!isDraft && (
              <>
                <span className="shrink-0 whitespace-nowrap">
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
                <span className="shrink-0">·</span>
                <span className="text-purple-600 truncate max-w-[60px]">#{cast.channelId}</span>
              </>
            )}
            {cast.media.length > 0 && (
              <>
                <span className="shrink-0">·</span>
                <span className="flex items-center gap-0.5 shrink-0">
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

        {cast.status === 'published' ? (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-3.5 h-3.5 text-black" />
          </div>
        ) : (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0",
            statusStyles[cast.status] || 'bg-muted text-muted-foreground border-border'
          )}>
            {statusLabels[cast.status] || cast.status}
          </span>
        )}

        {/* Link a Warpcast en vista colapsada */}
        {cast.status === 'published' && cast.castHash && (
          <a
            href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1"
            onClick={(e) => e.stopPropagation()}
            title="Ver en Warpcast"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {/* Acciones (siempre visibles) */}
        {cast.status !== 'published' && (
          <div className="flex items-center gap-1">
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
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
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
          "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
          expanded && "rotate-180"
        )} />
      </div>

      {/* Vista expandida */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border bg-muted/30">
          <p className="text-sm text-foreground leading-relaxed py-3 whitespace-pre-wrap">
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
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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

