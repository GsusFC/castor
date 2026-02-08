'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { fetchApiData, ApiRequestError } from '@/lib/fetch-json'
import {
  buildEmbedsFromCast,
  buildThreadEmbedsPayload,
  validateMediaReady,
} from '@/lib/compose'
import type { CastItem, Channel, ReplyToCast } from '@/components/compose/types'

interface UseComposeSubmitOptions {
  casts: CastItem[]
  selectedAccountId: string | null
  selectedChannel: Channel | null
  replyTo: ReplyToCast | null
  scheduleDate: string
  scheduleTime: string
  scheduleToISO: () => string | null
  isEditMode: boolean
  editCastId: string | null
  onSuccess: (data?: { castId?: string; status?: string }) => void
}

interface UseComposeSubmitReturn {
  handleSchedule: () => Promise<void>
  handlePublishNow: () => Promise<void>
  handleSaveDraft: () => Promise<void>
  isSubmitting: boolean
  isPublishing: boolean
  isSavingDraft: boolean
  error: string | null
  clearError: () => void
}

export function useComposeSubmit({
  casts,
  selectedAccountId,
  selectedChannel,
  replyTo,
  scheduleDate,
  scheduleTime,
  scheduleToISO,
  isEditMode,
  editCastId,
  onSuccess,
}: UseComposeSubmitOptions): UseComposeSubmitReturn {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Idempotency keys to prevent duplicate submissions
  const submitKeyRef = useRef<string | null>(null)
  const publishKeyRef = useRef<string | null>(null)
  const draftKeyRef = useRef<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const resetKeys = useCallback(() => {
    submitKeyRef.current = null
    publishKeyRef.current = null
    draftKeyRef.current = null
  }, [])

  const handleSuccess = useCallback((data?: { castId?: string; status?: string }) => {
    resetKeys()
    onSuccess(data)
    router.refresh()
  }, [onSuccess, router, resetKeys])

  const handleError = useCallback((err: unknown) => {
    const msg =
      err instanceof ApiRequestError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error'
    setError(msg)
    toast.error(msg)
  }, [])

  /**
   * Schedule cast(s) for later
   */
  const handleSchedule = useCallback(async () => {
    setError(null)

    if (!selectedAccountId) return

    const hasContent = casts.some((c) => c.content.trim().length > 0)
    if (!hasContent) return

    const hasSchedule = scheduleDate && scheduleTime
    if (!hasSchedule) return

    // Validate media
    const mediaError = validateMediaReady(casts)
    if (mediaError) {
      setError(mediaError)
      toast.error(mediaError)
      return
    }

    setIsSubmitting(true)

    try {
      if (!submitKeyRef.current) {
        submitKeyRef.current = crypto.randomUUID()
      }

      const scheduledAt = scheduleToISO()
      if (!scheduledAt) throw new Error('Invalid date')

      const isThread = casts.length > 1

      if (isThread) {
        // Schedule thread
        const res = await fetch('/api/casts/schedule-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccountId,
            channelId: selectedChannel?.id,
            scheduledAt,
            idempotencyKey: submitKeyRef.current,
            casts: buildThreadEmbedsPayload(casts),
          }),
        })

        const threadData = await res.json()
        if (!res.ok) throw new Error(threadData.error || 'Error scheduling thread')

        toast.success('Thread scheduled successfully')
        handleSuccess({ castId: threadData.data?.threadId, status: 'scheduled' })
        return
      } else {
        // Schedule single cast
        const cast = casts[0]
        const embeds = buildEmbedsFromCast(cast, { includeMetadata: true })

        const url = isEditMode && editCastId
          ? `/api/casts/${editCastId}`
          : '/api/casts/schedule'
        const method = isEditMode && editCastId ? 'PATCH' : 'POST'

        const body: Record<string, unknown> = {
          accountId: selectedAccountId,
          content: cast.content,
          channelId: selectedChannel?.id,
          scheduledAt,
          embeds: embeds.length > 0 ? embeds : undefined,
          parentHash: replyTo?.hash,
        }

        if (method === 'POST') {
          body.idempotencyKey = submitKeyRef.current
        }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const scheduleData = await res.json()
        if (!res.ok) throw new Error(scheduleData.error || 'Error scheduling cast')

        toast.success(isEditMode ? 'Cast updated successfully' : 'Cast scheduled successfully')
        handleSuccess({ castId: scheduleData.data?.castId || editCastId, status: isEditMode ? 'scheduled' : 'scheduled' })
        return
      }
    } catch (err) {
      handleError(err)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    casts,
    selectedAccountId,
    selectedChannel,
    replyTo,
    scheduleDate,
    scheduleTime,
    scheduleToISO,
    isEditMode,
    editCastId,
    handleSuccess,
    handleError,
  ])

  /**
   * Publish cast immediately
   */
  const handlePublishNow = useCallback(async () => {
    setError(null)

    if (!selectedAccountId) return

    const cast = casts[0]
    const hasEmbeds = cast?.media?.some((m) => m.url) || (cast?.links?.length ?? 0) > 0
    const canPublish = cast?.content?.trim().length > 0 || hasEmbeds
    if (!canPublish) return

    // Validate media
    const mediaError = validateMediaReady(casts)
    if (mediaError) {
      setError(mediaError)
      toast.error(mediaError)
      return
    }

    setIsPublishing(true)

    try {
      if (!publishKeyRef.current) {
        publishKeyRef.current = crypto.randomUUID()
      }

      const embeds = buildEmbedsFromCast(cast, { includeMetadata: false })

      const publishResult = await fetchApiData<{ hash: string; cast: unknown }>('/api/casts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          content: cast.content,
          channelId: selectedChannel?.id,
          embeds: embeds.length > 0 ? embeds : undefined,
          parentHash: replyTo?.hash,
          idempotencyKey: publishKeyRef.current,
        }),
      })

      toast.success('Cast published!')
      handleSuccess({ castId: publishResult.hash, status: 'published' })
    } catch (err) {
      handleError(err)
    } finally {
      setIsPublishing(false)
    }
  }, [casts, selectedAccountId, selectedChannel, replyTo, handleSuccess, handleError])

  /**
   * Save cast as draft
   */
  const handleSaveDraft = useCallback(async () => {
    setError(null)

    if (!selectedAccountId) {
      toast.error('Please select an account')
      return
    }

    // Validate media
    const mediaError = validateMediaReady(casts)
    if (mediaError) {
      setError(mediaError)
      toast.error(mediaError)
      return
    }

    setIsSavingDraft(true)

    try {
      if (!draftKeyRef.current) {
        draftKeyRef.current = crypto.randomUUID()
      }

      const cast = casts[0]
      const embeds = buildEmbedsFromCast(cast, { includeMetadata: true })
      const scheduledAt = scheduleToISO()

      const res = await fetch('/api/casts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          content: cast.content,
          channelId: selectedChannel?.id,
          scheduledAt: scheduledAt || undefined,
          embeds: embeds.length > 0 ? embeds : undefined,
          isDraft: true,
          idempotencyKey: draftKeyRef.current,
        }),
      })

      const draftData = await res.json()
      if (!res.ok) throw new Error(draftData.error || 'Error saving draft')

      toast.success('Draft saved')
      handleSuccess({ castId: draftData.data?.castId, status: 'draft' })
    } catch (err) {
      handleError(err)
    } finally {
      setIsSavingDraft(false)
    }
  }, [casts, selectedAccountId, selectedChannel, scheduleToISO, handleSuccess, handleError])

  return {
    handleSchedule,
    handlePublishNow,
    handleSaveDraft,
    isSubmitting,
    isPublishing,
    isSavingDraft,
    error,
    clearError,
  }
}
