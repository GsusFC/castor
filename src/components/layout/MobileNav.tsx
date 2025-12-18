'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Plus, FileText, LayoutTemplate, Rss, Search, Bell, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { useUserChannels } from '@/hooks/useUserChannels'
import { useDebounce } from '@/hooks/useDebounce'
import { useNotifications } from '@/context/NotificationsContext'
import { MobileNavDraftsSheet } from '@/components/layout/MobileNavDraftsSheet'
import { MobileNavTemplatesSheet } from '@/components/layout/MobileNavTemplatesSheet'
import { MobileNavSearchSheet } from '@/components/layout/MobileNavSearchSheet'

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
  const [isSheetLayerActive, setIsSheetLayerActive] = useState(false)

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
  const { unreadCount, open: openNotifications, isOpen: isNotificationsOpen } = useNotifications()

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
    if (!confirm('Delete this draft?')) return

    try {
      const res = await fetch(`/api/casts/${draftId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      setDrafts(prev => prev.filter(d => d.id !== draftId))
      toast.success('Draft deleted')
    } catch {
      toast.error('Error deleting')
    }
  }

  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation()
    if (!confirm('Delete this template?')) return

    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      toast.success('Template deleted')
    } catch {
      toast.error('Error deleting')
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

  const handleSelectSearchUser = (username: string) => {
    setSearchOpen(false)
    router.push(`/user/${username}`)
  }

  const handleSelectSearchChannel = (channelId: string) => {
    setSearchOpen(false)
    router.push(`/?channel=${channelId}`)
  }

  const isAnySheetOpen = searchOpen || draftsOpen || templatesOpen || isNotificationsOpen
  const isNavLayerActive = isAnySheetOpen || isSheetLayerActive

  useEffect(() => {
    if (isAnySheetOpen) {
      setIsSheetLayerActive(true)
      return
    }

    const timeoutId = setTimeout(() => {
      setIsSheetLayerActive(false)
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [isAnySheetOpen])

  return (
    <>
      {/* FAB - New Cast button - fixed above nav (oculto cuando sheets están abiertos) */}
      {!isNavLayerActive && (
        <button
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 lg:hidden"
          aria-label="New Cast"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Bottom navigation - only visible on mobile */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 border-t border-border lg:hidden pb-safe',
          isNavLayerActive
            ? 'z-[80] pointer-events-none bg-card'
            : 'z-20 bg-card/95 backdrop-blur-xl'
        )}
      >
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
                type="button"
                onClick={openNotifications}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
                aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Open notifications'}
              >
                <Bell className="w-5 h-5" />
                <span className="text-[10px] font-medium">Notifs</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-6 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>

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

              <Link
                href="/settings"
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-medium">Settings</span>
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
      <MobileNavDraftsSheet
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        drafts={filteredDrafts}
        isLoading={isLoading}
        onEditDraft={handleEditDraft}
        onDeleteDraft={handleDeleteDraft}
      />

      {/* Templates Sheet */}
      <MobileNavTemplatesSheet
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        templates={filteredTemplates}
        isLoading={isLoading}
        onUseTemplate={handleUseTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      {/* Search Sheet - Mobile first: input abajo, resultados arriba */}
      <MobileNavSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        onSelectUser={handleSelectSearchUser}
        onSelectChannel={handleSelectSearchChannel}
      />

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAccountId={selectedAccountId}
      />
    </>
  )
}
