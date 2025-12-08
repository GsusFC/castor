'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, Plus, FileText, LayoutTemplate, Edit, Trash2, Rss } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
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
  const [isLoading, setIsLoading] = useState(false)

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
    router.push(`/dashboard?edit=${draftId}`)
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

  // Filtrar por cuenta seleccionada
  const filteredDrafts = selectedAccountId
    ? drafts.filter(d => d.accountId === selectedAccountId)
    : drafts

  const filteredTemplates = selectedAccountId
    ? templates.filter(t => t.accountId === selectedAccountId)
    : templates

  return (
    <>
      {/* FAB - New Cast button - fixed above nav */}
      <button
        onClick={() => setComposeOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 sm:hidden"
        aria-label="New Cast"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Bottom navigation - only visible on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-20 sm:hidden safe-bottom">
        <div className="flex items-center justify-around h-16 px-4">
          {/* Home */}
          <Link
            href="/dashboard"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors",
              pathname === '/dashboard'
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          {/* Feed */}
          <Link
            href="/dashboard/feed"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors",
              pathname === '/dashboard/feed'
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Rss className="w-5 h-5" />
            <span className="text-[10px] font-medium">Feed</span>
          </Link>

          {/* Drafts */}
          <button
            onClick={() => setDraftsOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Drafts</span>
          </button>

          {/* Templates */}
          <button
            onClick={() => setTemplatesOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-lg transition-colors text-muted-foreground"
          >
            <LayoutTemplate className="w-5 h-5" />
            <span className="text-[10px] font-medium">Templates</span>
          </button>
        </div>
      </nav>

      {/* Drafts Sheet */}
      <Sheet open={draftsOpen} onOpenChange={setDraftsOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Drafts</SheetTitle>
            <SheetDescription>
              {filteredDrafts.length} borrador{filteredDrafts.length !== 1 && 'es'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : filteredDrafts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay borradores</p>
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
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Templates</SheetTitle>
            <SheetDescription>
              {filteredTemplates.length} template{filteredTemplates.length !== 1 && 's'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay templates</p>
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

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAccountId={selectedAccountId}
      />
    </>
  )
}
