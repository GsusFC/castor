'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Plus, Rss, Search, Bell, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { useNotifications } from '@/context/NotificationsContext'
import { MobileNavDraftsSheet } from '@/components/layout/MobileNavDraftsSheet'
import { MobileNavTemplatesSheet } from '@/components/layout/MobileNavTemplatesSheet'
import { useSearch } from '@/context/SearchContext'
import { MobileNavMoreSheet } from '@/components/layout/MobileNavMoreSheet'

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
  const [moreOpen, setMoreOpen] = useState(false)
  const { selectedAccountId } = useSelectedAccount()

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSheetLayerActive, setIsSheetLayerActive] = useState(false)

  const { unreadCount, open: openNotifications, isOpen: isNotificationsOpen } = useNotifications()
  const { open: openSearch, isOpen: isSearchOpen } = useSearch()

  const isFeedActive = pathname === '/' || pathname.startsWith('/user') || pathname.startsWith('/cast')
  const isStudioActive = pathname.startsWith('/studio')
  const isNotificationsActive = isNotificationsOpen || pathname.startsWith('/notifications')
  const isMoreActive = moreOpen || pathname.startsWith('/accounts') || pathname.startsWith('/settings')

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

  // Filtrar por cuenta seleccionada
  const filteredDrafts = selectedAccountId
    ? drafts.filter(d => d.accountId === selectedAccountId)
    : drafts

  const filteredTemplates = selectedAccountId
    ? templates.filter(t => t.accountId === selectedAccountId)
    : templates

  const isAnySheetOpen = draftsOpen || templatesOpen || moreOpen || isNotificationsOpen || isSearchOpen
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
      {/* FABs - Search (left) + New Cast (right) - fixed above nav */}
      {!isNavLayerActive && (
        <>
          <button
            type="button"
            onClick={openSearch}
            className="fixed bottom-20 left-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 lg:hidden"
            aria-label="Search"
          >
            <Search className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="fixed bottom-20 right-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 lg:hidden"
            aria-label="New Cast"
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Bottom navigation - only visible on mobile */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 border-t border-border lg:hidden pb-safe',
          isAnySheetOpen
            ? 'z-[80] pointer-events-none bg-card'
            : isNavLayerActive
              ? 'z-[80] bg-card'
              : 'z-20 bg-card/95 backdrop-blur-xl'
        )}
      >
        <div className="flex items-center justify-around h-16 px-4">
          <Link
            href="/"
            aria-current={isFeedActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors',
              isFeedActive ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Rss className="w-5 h-5" />
            <span className="text-[10px] font-medium">Feed</span>
          </Link>

          <Link
            href="/studio"
            aria-current={isStudioActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors',
              isStudioActive ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Studio</span>
          </Link>

          <button
            type="button"
            onClick={openNotifications}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors',
              isNotificationsActive ? 'text-foreground' : 'text-muted-foreground'
            )}
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
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors',
              isMoreActive ? 'text-foreground' : 'text-muted-foreground'
            )}
            aria-label="Open more menu"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
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

      <MobileNavMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        onOpenDrafts={() => setDraftsOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
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
