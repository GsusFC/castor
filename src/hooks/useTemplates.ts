'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface Template {
  id: string
  accountId: string
  name: string
  content: string
  channelId: string | null
}

interface UseTemplatesReturn {
  templates: Template[]
  isLoading: boolean
  isSaving: boolean
  loadTemplates: () => Promise<void>
  saveTemplate: (data: { name: string; content: string; channelId?: string | null }) => Promise<Template | null>
  deleteTemplate: (id: string) => Promise<boolean>
}

export const useTemplates = (accountId: string | null): UseTemplatesReturn => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    if (!accountId) {
      setTemplates([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/templates?accountId=${accountId}`)
      if (!res.ok) throw new Error('Error al cargar templates')

      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Error loading templates:', err)
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const saveTemplate = useCallback(async (data: {
    name: string
    content: string
    channelId?: string | null
  }): Promise<Template | null> => {
    if (!accountId) {
      toast.error('Selecciona una cuenta primero')
      return null
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          name: data.name.trim(),
          content: data.content,
          channelId: data.channelId,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al guardar template')
      }

      const result = await res.json()
      toast.success('Template guardado')

      // Recargar lista
      await loadTemplates()

      return result.template
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [accountId, loadTemplates])

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar template')

      toast.success('Template eliminado')
      await loadTemplates()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg)
      return false
    }
  }, [loadTemplates])

  return {
    templates,
    isLoading,
    isSaving,
    loadTemplates,
    saveTemplate,
    deleteTemplate,
  }
}
