'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Plus, FileText, LayoutTemplate, Edit, Trash2, Rss, Search, X, User, Hash, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { useUserChannels } from '@/hooks/useUserChannels'
import { useDebounce } from '@/hooks/useDebounce'
import { PowerBadge } from '@/components/ui/PowerBadge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface Draft {
  id: string
  content: string
  accountId: string
  channelId: string | null
  scheduledAt: string
  account: { username: string; pfpUrl: string | null } | null
}

interface Template {
  id: string
  name: string
  content: string
  channelId: string | null
  accountId: string
}

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [composeOpen, setComposeOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const { selectedAccountId } = useSelectedAccount()

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    users: any[]
    channels: any[]
    casts: any[]
  }>({ users: [], channels: [], casts: [] })
  const [isSearching, setIsSearching] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 300)
  const { favorites, toggleFavorite } = useUserChannels()

  // Cargar drafts cuando se abre el sheet
  useEffect(() => {
    if (draftsOpen) {
      setIsLoading(true)
      fetch('/api/casts?status=draft')
        .then(res => res.json())
        .then(data => setDrafts(data.casts || []))
        .catch(() => setDrafts([]))
        .finally(() => setIsLoading(false))
    }
  }, [draftsOpen])

  // Cargar templates cuando se abre el sheet (requiere accountId)
  useEffect(() => {
    if (templatesOpen && selectedAccountId) {
      setIsLoading(true)
      fetch(`/api/templates?accountId=${selectedAccountId}`)
        .then(res => res.json())
        .then(data => setTemplates(data.templates || []))
        .catch(() => setTemplates([]))
        .finally(() => setIsLoading(false))
    } else if (templatesOpen) {
      setTemplates([])
    }
  }, [templatesOpen, selectedAccountId])

  // Búsqueda global
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults({ users: [], channels: [], casts: [] })
      return
    }

    const search = async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults({
            users: data.users || [],
            channels: data.channels || [],
            casts: data.casts || [],
          })
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }

    search()
  }, [debouncedQuery])

  // Limpiar búsqueda al cerrar
  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('')
      setSearchResults({ users: [], channels: [], casts: [] })
    }
  }, [searchOpen])

  const handleEditDraft = (draftId: string) => {
    setDraftsOpen(false)
    router.push(`/studio?edit=${draftId}`)
  }

  const handleUseTemplate = (template: Template) => {
    setTemplatesOpen(false)
    setComposeOpen(true)
    // El contenido se pasará a través de defaultContent
  }

  const handleDeleteDraft = async (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este borrador?')) return
    
    try {
      const res = await fetch(`/api/casts/${draftId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      setDrafts(prev => prev.filter(d => d.id !== draftId))
      toast.success('Borrador eliminado')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este template?')) return
    
    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      toast.success('Template eliminado')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // Detectar si estamos en la sección de feed
  const isFeedSection = pathname === '/' || pathname?.startsWith('/user')

  // Filtrar por cuenta seleccionada
  const filteredDrafts = selectedAccountId
    ? drafts.filter(d => d.accountId === selectedAccountId)
    : drafts

  const filteredTemplates = selectedAccountId
    ? templates.filter(t => t.accountId === selectedAccountId)
    : templates

  return (
    <>
      {/* FAB - New Cast button - fixed above nav (oculto cuando sheets están abiertos) */}
      {!searchOpen && !draftsOpen && !templatesOpen && (
        <button
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 lg:hidden"
          aria-label="New Cast"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Bottom navigation - only visible on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-20 lg:hidden pb-safe">
        <div className="flex items-center justify-around h-16 px-4">
          {/* Menú contextual según la sección */}
          {isFeedSection ? (
            <>
              {/* En Feed: Home, Search, Accounts */}
              <Link
                href="/studio"
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
              >
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-medium">Studio</span>
              </Link>

              <button
                onClick={() => setSearchOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
              >
                <Search className="w-5 h-5" />
                <span className="text-[10px] font-medium">Search</span>
              </button>

            </>
          ) : (
            <>
              {/* En Dashboard: Feed, Drafts, Templates */}
              <Link
                href="/"
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
              >
                <Rss className="w-5 h-5" />
                <span className="text-[10px] font-medium">Feed</span>
              </Link>

              <button
                onClick={() => setDraftsOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
              >
                <FileText className="w-5 h-5" />
                <span className="text-[10px] font-medium">Drafts</span>
              </button>

              <button
                onClick={() => setTemplatesOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
              >
                <LayoutTemplate className="w-5 h-5" />
                <span className="text-[10px] font-medium">Templates</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Drafts Sheet */}
      <Sheet open={draftsOpen} onOpenChange={setDraftsOpen}>
        <SheetContent side="bottom" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Drafts</SheetTitle>
              <span className="text-xs text-muted-foreground">({filteredDrafts.length})</span>
            </div>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-6">Cargando...</p>
            ) : filteredDrafts.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No hay borradores</p>
            ) : (
              filteredDrafts.map(draft => (
                <div
                  key={draft.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => handleEditDraft(draft.id)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    {draft.account?.pfpUrl ? (
                      <img src={draft.account.pfpUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                    )}
                    <p className="flex-1 min-w-0 text-sm truncate">
                      {draft.content || <span className="text-muted-foreground italic">Sin contenido</span>}
                    </p>
                    <Edit className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteDraft(e, draft.id)}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Templates Sheet */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent side="bottom" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Templates</SheetTitle>
              <span className="text-xs text-muted-foreground">({filteredTemplates.length})</span>
            </div>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-6">Cargando...</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No hay templates</p>
            ) : (
              filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="w-full flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.content}</p>
                    {template.channelId && (
                      <span className="text-xs text-purple-600">#{template.channelId}</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => handleDeleteTemplate(e, template.id)}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Search Sheet - Mobile first: input abajo, resultados arriba */}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0" aria-describedby={undefined}>
          <SheetHeader className="sr-only">
            <SheetTitle>Buscar</SheetTitle>
          </SheetHeader>
          {/* Área de resultados - scrollable */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
            {/* Header con título (desaparece al buscar) */}
            {!searchQuery && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Search</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Usuarios, canales y casts
                </p>
              </div>
            )}

            {/* Loading */}
            {isSearching && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Sin resultados */}
            {!isSearching && searchQuery.length >= 2 && 
              searchResults.users.length === 0 && 
              searchResults.channels.length === 0 && 
              searchResults.casts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron resultados
              </div>
            )}

            {/* Resultados agrupados */}
            {!isSearching && (searchResults.users.length > 0 || searchResults.channels.length > 0 || searchResults.casts.length > 0) && (
              <div className="space-y-6">
                {/* Usuarios */}
                {searchResults.users.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuarios</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-1">
                      {searchResults.users.map((user: any) => (
                        <button
                          key={user.fid}
                          onClick={() => {
                            setSearchOpen(false)
                            router.push(`/user/${user.username}`)
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                          {user.pfp_url ? (
                            <img src={user.pfp_url} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-sm truncate">{user.display_name}</span>
                              {user.power_badge && <PowerBadge size={14} />}
                            </div>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{user.follower_count?.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Canales */}
                {searchResults.channels.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Canales</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-1">
                      {searchResults.channels.map((channel: any) => {
                        const isFav = favorites.some(f => f.id === channel.id)
                        return (
                          <div
                            key={channel.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                          >
                            <button
                              onClick={() => {
                                setSearchOpen(false)
                                router.push(`/?channel=${channel.id}`)
                              }}
                              className="flex-1 flex items-center gap-3 text-left"
                            >
                              {channel.image_url ? (
                                <img src={channel.image_url} alt="" className="w-10 h-10 rounded-lg" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Hash className="w-5 h-5 text-primary" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm">/{channel.name || channel.id}</span>
                                {channel.description && (
                                  <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{channel.follower_count?.toLocaleString()}</span>
                            </button>
                            <button
                              onClick={() => toggleFavorite({ id: channel.id, name: channel.name, imageUrl: channel.image_url })}
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                              <Star className={cn("w-4 h-4", isFav ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground")} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Casts */}
                {searchResults.casts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Casts</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-1">
                      {searchResults.casts.map((cast: any) => (
                        <button
                          key={cast.hash}
                          onClick={() => {
                            setSearchOpen(false)
                            router.push(`/user/${cast.author?.username}`)
                          }}
                          className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          {cast.author?.pfp_url ? (
                            <img src={cast.author.pfp_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium">@{cast.author?.username}</span>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{cast.text}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input sticky en la parte inferior */}
          <div className="shrink-0 px-4 py-3 border-t border-border bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-11 pr-10 py-3 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAccountId={selectedAccountId}
      />
    </>
  )
}
