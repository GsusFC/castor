'use client'

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { Pen, X } from 'lucide-react'
import { ComposeCard } from '@/components/compose/ComposeCard'
import { Channel, ReplyToCast, PublishNetwork } from '@/components/compose/types'
import type { Account } from '@/components/compose/types'
import { calculateTextLength } from '@/lib/url-utils'
import { getMaxChars, getMaxEmbeds } from '@/lib/compose'
import { useAccountsV2 } from '@/hooks/useAccountsV2'
import { useScheduleFormV2 } from '@/hooks/useScheduleFormV2'
import { useCastThread } from '@/hooks/useCastThread'
import { useComposeSubmit } from '@/hooks/useComposeSubmit'
import { useTemplates, Template } from '@/hooks/useTemplates'
import type { SerializedCast } from '@/types'
import { Button } from '@/components/ui/button'
import { formatStudioDate } from '@/lib/studio-datetime'

interface ComposerPanelProps {
  /** Accounts from the server — no client-side fetching needed */
  accounts: Account[]
  /** User's FID for auto-selecting their account */
  userFid: number
  /** Optional pre-selected account */
  defaultAccountId?: string | null
  /** Templates from the server */
  templates?: Template[]
  /** Called when a cast is created/submitted — for optimistic UI updates */
  onCastCreated?: (cast: SerializedCast) => void
  /** Emits minimal composer status for focus-mode utilities */
  onComposerStateChange?: (state: ComposerFocusState) => void
}

type TypefullySocialSetOption = {
  socialSetId: number
  label: string
  connectedPlatforms: string[]
}

export type ComposerFocusState = {
  selectedNetworks: PublishNetwork[]
  availableNetworks: Record<PublishNetwork, boolean>
  hasContent: boolean
  hasMedia: boolean
  isMediaReady: boolean
  hasOverLimit: boolean
  typefullyLinked: boolean
  scheduleReady: boolean
}

/** Methods exposed to parent via ref */
export interface ComposerPanelRef {
  /** Load an existing cast into the composer for editing */
  loadCast: (cast: SerializedCast) => void
  /** Set the schedule date (from calendar day click) */
  setScheduleDate: (date: Date) => void
  /** Clear current draft/edit state and start a new cast */
  startNewCast: () => void
}

function isRenderableMedia(url: string, type: 'image' | 'video'): boolean {
  if (!url) return false
  if (type === 'video') return true
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  if (url.includes('imagedelivery.net') || url.includes('cloudflare')) return true
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url)
}

/**
 * V2 ComposerPanel — persistent side panel replacing the modal composer.
 *
 * Improvements over v1 ComposeModal:
 * - No dialog/modal wrapper — always visible as a panel
 * - Uses server-provided accounts (no 3 API calls on mount)
 * - Uses browser timezone (not hardcoded Europe/Madrid)
 * - Uses nanoid for IDs (not Math.random)
 * - Reuses ComposeCard for the actual editor UI
 * - Imperative ref for external interactions (calendar click, queue click)
 */
export const ComposerPanel = forwardRef<ComposerPanelRef, ComposerPanelProps>(
  function ComposerPanel(
    { accounts: serverAccounts, userFid, defaultAccountId, onCastCreated, onComposerStateChange },
    ref
  ) {
    // Map SerializedAccount to compose Account type
    const composeAccounts: Account[] = serverAccounts.map(a => ({
      id: a.id,
      fid: a.fid,
      username: a.username,
      displayName: a.displayName,
      pfpUrl: a.pfpUrl,
      isPremium: (a as unknown as { isPremium?: boolean }).isPremium,
      signerStatus: (a as unknown as { signerStatus?: string }).signerStatus,
      ownerId: (a as unknown as { ownerId?: string | null }).ownerId,
    }))

    // Hooks — v2 optimized versions
    const {
      accounts,
      selectedAccountId,
      selectedAccount,
      isLoading: isLoadingAccounts,
      setSelectedAccountId,
    } = useAccountsV2({
      accounts: composeAccounts,
      userFid,
      defaultAccountId,
    })

    const schedule = useScheduleFormV2()
    const thread = useCastThread()
    const { templates, isSaving: isSavingTemplate, saveTemplate } = useTemplates(selectedAccountId)

    // Local state
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
    const [replyTo, setReplyTo] = useState<ReplyToCast | null>(null)
    const [editCastId, setEditCastId] = useState<string | null>(null)
    const [selectedNetworks, setSelectedNetworks] = useState<PublishNetwork[]>(['farcaster'])
    const [availableNetworks, setAvailableNetworks] = useState<Record<PublishNetwork, boolean>>({
      farcaster: true,
      x: false,
      linkedin: false,
    })
    const [typefullySocialSets, setTypefullySocialSets] = useState<TypefullySocialSetOption[]>([])
    const [selectedTypefullySocialSetId, setSelectedTypefullySocialSetId] = useState<number | null>(null)
    const [networkMappingHint, setNetworkMappingHint] = useState<string | null>(null)
    const isEditMode = !!editCastId

    // Reset form
    const resetForm = useCallback(() => {
      thread.reset()
      schedule.reset()
      setSelectedChannel(null)
      setReplyTo(null)
      setEditCastId(null)
      setSelectedNetworks(['farcaster'])
    }, [thread, schedule])

    useEffect(() => {
      const loadAccountNetworks = async () => {
        if (!selectedAccountId) return

        try {
          const res = await fetch('/api/integrations/typefully/social-sets', { cache: 'no-store' })
          if (!res.ok) {
            setTypefullySocialSets([])
            setSelectedTypefullySocialSetId(null)
            setAvailableNetworks({ farcaster: true, x: false, linkedin: false })
            setSelectedNetworks(['farcaster'])
            return
          }

          const data = await res.json().catch(() => ({}))
          const socialSets = Array.isArray(data?.socialSets) ? data.socialSets : []
          const options: TypefullySocialSetOption[] = socialSets.map((set: any) => ({
            socialSetId: set.socialSetId,
            label: `@${set.username}${set.teamName ? ` · ${set.teamName}` : ''}`,
            connectedPlatforms: Array.isArray(set.connectedPlatforms) ? set.connectedPlatforms : [],
          }))
          setTypefullySocialSets(options)

          const selectedUsername = selectedAccount?.username?.toLowerCase()
          let linked = selectedTypefullySocialSetId
            ? socialSets.find((set: any) => set?.socialSetId === selectedTypefullySocialSetId)
            : null
          if (!linked) {
            linked = socialSets.find(
              (set: any) =>
                set?.linkedAccountId === selectedAccountId || set?.linkedAccount?.id === selectedAccountId
            )
          }
          if (!linked && selectedUsername) {
            linked = socialSets.find(
              (set: any) => String(set?.linkedAccount?.username || '').toLowerCase() === selectedUsername
            )
          }
          if (!linked && selectedUsername) {
            linked = socialSets.find(
              (set: any) => String(set?.username || '').toLowerCase() === selectedUsername
            )
          }
          if (!linked) {
            linked = socialSets.find((set: any) => {
              const connected = Array.isArray(set?.connectedPlatforms) ? set.connectedPlatforms : []
              return connected.includes('x') || connected.includes('linkedin')
            })
          }
          if (!linked && socialSets.length > 0) {
            linked = socialSets[0]
          }

          setSelectedTypefullySocialSetId(linked?.socialSetId ?? null)
          const connected = Array.isArray(linked?.connectedPlatforms) ? linked.connectedPlatforms : []
          setNetworkMappingHint(
            linked
              ? null
              : socialSets.length > 0
                ? 'Select a Typefully account to enable X/LinkedIn publishing.'
                : 'Connect Typefully to enable X/LinkedIn.'
          )

          const nextAvailability = {
            farcaster: true,
            x: connected.includes('x'),
            linkedin: connected.includes('linkedin'),
          } satisfies Record<PublishNetwork, boolean>

          setAvailableNetworks(nextAvailability)
          setSelectedNetworks((prev) => {
            const filtered = prev.filter((network) => nextAvailability[network])
            return filtered.length > 0 ? filtered : ['farcaster']
          })
        } catch {
          setTypefullySocialSets([])
          setSelectedTypefullySocialSetId(null)
          setNetworkMappingHint('Could not load Typefully social sets for this account.')
          setAvailableNetworks({ farcaster: true, x: false, linkedin: false })
          setSelectedNetworks(['farcaster'])
        }
      }

      void loadAccountNetworks()
    }, [selectedAccountId, selectedAccount?.username])

    useEffect(() => {
      if (!selectedTypefullySocialSetId) return
      const selected = typefullySocialSets.find((set) => set.socialSetId === selectedTypefullySocialSetId)
      const connected = selected?.connectedPlatforms || []
      const nextAvailability = {
        farcaster: true,
        x: connected.includes('x'),
        linkedin: connected.includes('linkedin'),
      } satisfies Record<PublishNetwork, boolean>

      setAvailableNetworks(nextAvailability)
      setSelectedNetworks((prev) => {
        const filtered = prev.filter((network) => nextAvailability[network])
        return filtered.length > 0 ? filtered : ['farcaster']
      })
    }, [selectedTypefullySocialSetId, typefullySocialSets])

    useEffect(() => {
      if (!selectedNetworks.includes('farcaster') && selectedChannel) {
        setSelectedChannel(null)
      }
    }, [selectedNetworks, selectedChannel])

    const handleToggleNetwork = useCallback((network: PublishNetwork) => {
      if (!availableNetworks[network]) return
      setSelectedNetworks((prev) => {
        if (prev.includes(network)) {
          const next = prev.filter((n) => n !== network)
          return next.length > 0 ? next : prev
        }
        return [...prev, network]
      })
    }, [availableNetworks])

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
      loadCast: (cast: SerializedCast) => {
        const safeMedia = (cast.media || [])
          .filter((m) => isRenderableMedia(m.url, m.type as 'image' | 'video'))
          .map((m) => ({
            preview: m.url,
            url: m.url,
            type: m.type as 'image' | 'video',
            uploading: false,
          }))

        // Set content
        thread.setCasts([{
          id: nanoid(),
          content: cast.content || '',
          media: safeMedia,
          links: [],
        }])

        // Set schedule
        if (cast.scheduledAt) {
          schedule.setFromISO(cast.scheduledAt)
        }

        // Set channel
        if (cast.channelId) {
          setSelectedChannel({ id: cast.channelId, name: cast.channelId })
        } else {
          setSelectedChannel(null)
        }

        // Set account
        if (cast.accountId) {
          setSelectedAccountId(cast.accountId)
        }

        // Track edit mode (only for scheduled/draft — not published)
        if (cast.status === 'scheduled' || cast.status === 'draft') {
          setEditCastId(cast.id)
        } else {
          setEditCastId(null)
        }

        setReplyTo(null)
        toast.success('Cast loaded in composer')
      },

      setScheduleDate: (date: Date) => {
        // Format as YYYY-MM-DD for the date input
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        schedule.setDate(`${year}-${month}-${day}`)

        // If no time set yet, default to next hour
        if (!schedule.time) {
          const now = new Date()
          const nextHour = new Date(now.getTime() + 60 * 60 * 1000)
          const hours = String(nextHour.getHours()).padStart(2, '0')
          schedule.setTime(`${hours}:00`)
        }

        toast.success(
          `Date set to ${formatStudioDate(date, { month: 'short', day: 'numeric' })}`
        )
      },
      startNewCast: () => {
        resetForm()
        toast.success('Composer is ready for a new cast')
      },
    }), [thread, schedule, setSelectedAccountId, resetForm])

    // Submit hook — with optimistic cast creation
    const handleSubmitSuccess = useCallback((data?: { castId?: string; status?: string }) => {
      if (onCastCreated && data?.castId && !isEditMode) {
        const cast = thread.casts[0]
        const account = accounts.find(a => a.id === selectedAccountId)
        const accountInfo = account ? {
          id: account.id,
          username: account.username,
          displayName: account.displayName,
          pfpUrl: account.pfpUrl,
        } : null
        const optimisticCast: SerializedCast = {
          id: data.castId,
          accountId: selectedAccountId || '',
          content: cast?.content || '',
          status: data.status || 'scheduled',
          scheduledAt: schedule.toISO() || new Date().toISOString(),
          publishedAt: data.status === 'published' ? new Date().toISOString() : null,
          castHash: null,
          channelId: selectedChannel?.id || null,
          errorMessage: null,
          retryCount: 0,
          media: cast?.media
            ?.filter(m => m.url)
            .map((m, i) => ({
              id: `temp-${i}`,
              url: m.url!,
              type: (m.type || 'image') as 'image' | 'video',
              thumbnailUrl: null,
            })) || [],
          account: accountInfo,
          createdBy: accountInfo,
        }
        onCastCreated(optimisticCast)
      }
      resetForm()
    }, [onCastCreated, isEditMode, thread.casts, accounts, selectedAccountId, schedule, selectedChannel, resetForm])

    const submit = useComposeSubmit({
      casts: thread.casts,
      selectedAccountId,
      selectedChannel,
      replyTo,
      scheduleDate: schedule.date,
      scheduleTime: schedule.time,
      scheduleToISO: schedule.toISO,
      selectedNetworks,
      availableNetworks,
      typefullySocialSetId: selectedTypefullySocialSetId,
      isEditMode,
      editCastId,
      onSuccess: handleSubmitSuccess,
    })

    // Derived state
    const isPro = selectedAccount?.isPremium ?? false
    const maxChars = getMaxChars(isPro)
    const maxEmbeds = getMaxEmbeds(isPro)
    const hasOverChars = thread.casts.some(cast => calculateTextLength(cast.content) > maxChars)
    const hasOverEmbeds = thread.casts.some(cast => (cast.media.length + cast.links.length) > maxEmbeds)
    const hasOverLimit = hasOverChars || hasOverEmbeds
    const hasContent = thread.casts.some(cast => cast.content.trim().length > 0)
    const hasMedia = thread.casts.some((cast) => cast.media.length > 0)
    const isMediaReady = thread.casts.every((cast) =>
      cast.media.every((media) => {
        if (media.uploading || media.error) return false
        if (media.type === 'video' && (media.videoStatus === 'pending' || media.videoStatus === 'processing')) {
          return false
        }
        return true
      })
    )
    const typefullyLinked = selectedTypefullySocialSetId !== null
    const scheduleReady = schedule.isValid

    // Template handlers
    const handleLoadTemplate = useCallback((template: Template) => {
      thread.setCasts([{
        id: nanoid(),
        content: template.content,
        media: [],
        links: [],
      }])
      if (template.channelId) {
        setSelectedChannel({ id: template.channelId, name: template.channelId })
      }
      setEditCastId(null)
      toast.success(`Template "${template.name}" loaded`)
    }, [thread])

    const handleSaveTemplate = useCallback(async () => {
      if (!hasContent) {
        toast.error('You need content to save a template')
        return
      }

      const name = prompt('Template name:')
      if (!name?.trim()) return

      const cast = thread.casts[0]
      await saveTemplate({
        name: name.trim(),
        content: cast.content,
        channelId: selectedChannel?.id,
      })
    }, [hasContent, thread.casts, selectedChannel, saveTemplate])

    useEffect(() => {
      if (!onComposerStateChange) return
      onComposerStateChange({
        selectedNetworks,
        availableNetworks,
        hasContent,
        hasMedia,
        isMediaReady,
        hasOverLimit,
        typefullyLinked,
        scheduleReady,
      })
    }, [
      onComposerStateChange,
      selectedNetworks,
      availableNetworks,
      hasContent,
      hasMedia,
      isMediaReady,
      hasOverLimit,
      typefullyLinked,
      scheduleReady,
    ])

    return (
      <div className="flex flex-col h-full">
        {/* Panel Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
          <Pen className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {isEditMode ? 'Editing cast' : thread.isThread ? 'New Thread' : 'Composer'}
          </span>
          {isEditMode && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2 text-xs text-muted-foreground"
              onClick={resetForm}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel edit
            </Button>
          )}
        </div>

        {/* Error banner */}
        {submit.error && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 text-sm shrink-0">
            {submit.error}
          </div>
        )}

        {/* ComposeCard — reused from v1, fills the panel */}
        <ComposeCard
          className="flex-1 min-h-0 border-0 rounded-none shadow-none"
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
          isLoadingAccounts={isLoadingAccounts}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          casts={thread.casts}
          onUpdateCast={thread.updateCast}
          onAddCast={thread.addCast}
          onRemoveCast={thread.removeCast}
          scheduledDate={schedule.date}
          scheduledTime={schedule.time}
          onDateChange={schedule.setDate}
          onTimeChange={schedule.setTime}
          replyTo={replyTo}
          onSelectReplyTo={setReplyTo}
          maxChars={maxChars}
          selectedNetworks={selectedNetworks}
          availableNetworks={availableNetworks}
          onToggleNetwork={handleToggleNetwork}
          typefullySocialSets={typefullySocialSets}
          selectedTypefullySocialSetId={selectedTypefullySocialSetId}
          onSelectTypefullySocialSet={setSelectedTypefullySocialSetId}
          networkMappingHint={networkMappingHint}
          isSubmitting={submit.isSubmitting}
          isPublishing={submit.isPublishing}
          isSavingDraft={submit.isSavingDraft}
          onSubmit={submit.handleSchedule}
          onPublishNow={submit.handlePublishNow}
          onSaveDraft={submit.handleSaveDraft}
          hasContent={hasContent}
          hasOverLimit={hasOverLimit}
          templates={templates}
          onLoadTemplate={handleLoadTemplate}
          onSaveTemplate={handleSaveTemplate}
          isSavingTemplate={isSavingTemplate}
        />
      </div>
    )
  }
)
