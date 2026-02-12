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
import type { CastItem, Channel, ReplyToCast, PublishNetwork } from '@/components/compose/types'

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
  selectedNetworks: PublishNetwork[]
  availableNetworks: Record<PublishNetwork, boolean>
  typefullySocialSetId?: number | null
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
  selectedNetworks,
  availableNetworks,
  typefullySocialSetId,
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

  const validateNetworkPreflight = useCallback(() => {
    if (selectedNetworks.length === 0) {
      return 'Select at least one destination network'
    }

    const wantsX = selectedNetworks.includes('x')
    const wantsLinkedIn = selectedNetworks.includes('linkedin')

    if (wantsX && !availableNetworks.x) return 'X is not connected for this account'
    if (wantsLinkedIn && !availableNetworks.linkedin) return 'LinkedIn is not connected for this account'
    if ((wantsX || wantsLinkedIn) && !typefullySocialSetId) {
      return 'Select a Typefully account to publish on X/LinkedIn'
    }

    if (!wantsX && !wantsLinkedIn) return null

    const xOverLimit = wantsX && casts.some((cast) => cast.content.trim().length > 280)
    if (xOverLimit) {
      return 'X posts cannot exceed 280 characters'
    }

    const linkedinOverLimit = wantsLinkedIn && casts.some((cast) => cast.content.trim().length > 3000)
    if (linkedinOverLimit) {
      return 'LinkedIn posts cannot exceed 3000 characters'
    }

    return null
  }, [selectedNetworks, availableNetworks, typefullySocialSetId, casts])

  const publishViaTypefully = useCallback(async (publishAt?: string | 'now') => {
    if (!selectedAccountId) return

    const networks = selectedNetworks.filter(
      (network): network is 'x' | 'linkedin' => network === 'x' || network === 'linkedin'
    )
    if (networks.length === 0) return

    const posts = casts.map((cast) => ({
      text: cast.content,
      mediaUrls: cast.media
        .map((media) => media.url)
        .filter((url): url is string => Boolean(url && /^https?:\/\//.test(url))),
    }))
    await fetchApiData('/api/integrations/typefully/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: selectedAccountId,
        networks,
        posts,
        ...(typefullySocialSetId ? { socialSetId: typefullySocialSetId } : {}),
        ...(publishAt ? { publishAt } : {}),
      }),
    })
  }, [casts, selectedAccountId, selectedNetworks, typefullySocialSetId])

  /**
   * Schedule cast(s) for later
   */
  const handleSchedule = useCallback(async () => {
    setError(null)

    if (!selectedAccountId) return

    const networkError = validateNetworkPreflight()
    if (networkError) {
      setError(networkError)
      toast.error(networkError)
      return
    }

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
      const wantsFarcaster = selectedNetworks.includes('farcaster')

      if (isThread && wantsFarcaster) {
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

        if (selectedNetworks.includes('x') || selectedNetworks.includes('linkedin')) {
          await publishViaTypefully(scheduledAt)
        }

        toast.success('Thread scheduled successfully')
        handleSuccess({ castId: threadData.data?.threadId, status: 'scheduled' })
        return
      }

      if (!isThread && wantsFarcaster) {
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

        if (selectedNetworks.includes('x') || selectedNetworks.includes('linkedin')) {
          await publishViaTypefully(scheduledAt)
        }

        toast.success(isEditMode ? 'Cast updated successfully' : 'Cast scheduled successfully')
        handleSuccess({ castId: scheduleData.data?.castId || editCastId, status: 'scheduled' })
        return
      }

      if (!wantsFarcaster && (selectedNetworks.includes('x') || selectedNetworks.includes('linkedin'))) {
        await publishViaTypefully(scheduledAt)
        toast.success('Post scheduled for selected networks')
        handleSuccess({ status: 'scheduled' })
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
    selectedNetworks,
    handleSuccess,
    handleError,
    validateNetworkPreflight,
    publishViaTypefully,
  ])

  /**
   * Publish cast immediately
   */
  const handlePublishNow = useCallback(async () => {
    setError(null)

    if (!selectedAccountId) return

    const networkError = validateNetworkPreflight()
    if (networkError) {
      setError(networkError)
      toast.error(networkError)
      return
    }

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

      const wantsFarcaster = selectedNetworks.includes('farcaster')
      let farcasterHash: string | undefined

      if (wantsFarcaster) {
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
        farcasterHash = publishResult.hash
      }

      if (selectedNetworks.includes('x') || selectedNetworks.includes('linkedin')) {
        await publishViaTypefully('now')
      }

      toast.success('Published to selected networks')
      handleSuccess({ castId: farcasterHash, status: 'published' })
    } catch (err) {
      handleError(err)
    } finally {
      setIsPublishing(false)
    }
  }, [
    casts,
    selectedAccountId,
    selectedChannel,
    replyTo,
    selectedNetworks,
    handleSuccess,
    handleError,
    validateNetworkPreflight,
    publishViaTypefully,
  ])

  /**
   * Save cast as draft
   */
  const handleSaveDraft = useCallback(async () => {
    setError(null)

    if (!selectedAccountId) {
      toast.error('Please select an account')
      return
    }

    if (!selectedNetworks.includes('farcaster')) {
      toast.error('Drafts are currently only available for Farcaster')
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
  }, [casts, selectedAccountId, selectedChannel, scheduleToISO, selectedNetworks, handleSuccess, handleError])

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
