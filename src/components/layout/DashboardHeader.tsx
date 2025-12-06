'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, FileText, LayoutTemplate, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComposeModal } from '@/components/compose/ComposeModal'
import { useSelectedAccount } from '@/context/SelectedAccountContext'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { toast } from 'sonner'
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

export function DashboardHeader() {
  const [composeOpen, setComposeOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { selectedAccountId } = useSelectedAccount()

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

  // Cargar templates cuando se abre el sheet
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

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error('Error signing out')
      // Force full page reload to clear all client state
      window.location.href = '/'
    } catch (err) {
      toast.error('Error signing out')
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-b border-border z-20 safe-top">
        <div className="h-14 sm:h-16 max-w-6xl mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 sm:gap-3 group min-h-[44px] touch-target"
          >
            <img 
              src="/brand/logo.png" 
              alt="Castor" 
              className="w-8 h-8 flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            <span className="font-display text-base sm:text-lg text-foreground sm-fade-hide responsive-text">
              Castor
            </span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Drafts button - hidden on mobile */}
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setDraftsOpen(true)} 
              className="hidden sm:flex gap-2 h-9 px-3 text-muted-foreground hover:text-foreground"
            >
              <FileText className="w-4 h-4" />
              <span>Drafts</span>
            </Button>
            {/* Templates button - hidden on mobile */}
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setTemplatesOpen(true)} 
              className="hidden sm:flex gap-2 h-9 px-3 text-muted-foreground hover:text-foreground"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Templates</span>
            </Button>
            {/* New Cast button - hidden on mobile (use bottom nav instead) */}
            <Button 
              onClick={() => setComposeOpen(true)} 
              size="sm" 
              className="hidden sm:flex gap-2 h-9 px-3"
            >
              <Plus className="w-4 h-4" />
              <span>New Cast</span>
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-10 w-10 touch-target text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <ComposeModal 
        open={composeOpen} 
        onOpenChange={setComposeOpen} 
        defaultAccountId={selectedAccountId}
      />

      {/* Drafts Sheet */}
      <Sheet open={draftsOpen} onOpenChange={setDraftsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Drafts</SheetTitle>
            <SheetDescription>Your saved drafts</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : filteredDrafts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No drafts</p>
            ) : (
              filteredDrafts.map(draft => (
                <div
                  key={draft.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
                  onClick={() => handleEditDraft(draft.id)}
                >
                  <div className="flex items-start gap-3">
                    {draft.account?.pfpUrl && (
                      <img 
                        src={draft.account.pfpUrl} 
                        alt="" 
                        className="w-8 h-8 rounded-full shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{draft.content || 'Empty draft'}</p>
                      {draft.channelId && (
                        <span className="text-xs text-purple-500">#{draft.channelId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDeleteDraft(e, draft.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Templates Sheet */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Templates</SheetTitle>
            <SheetDescription>Your saved templates</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : !selectedAccountId ? (
              <p className="text-sm text-muted-foreground text-center py-4">Select an account first</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No templates</p>
            ) : (
              filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
                  onClick={() => {
                    setTemplatesOpen(false)
                    setComposeOpen(true)
                  }}
                >
                  <div className="flex items-start gap-3">
                    <LayoutTemplate className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{template.content}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteTemplate(e, template.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
