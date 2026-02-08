import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { ComposerPanelRef } from '@/components/v2/ComposerPanel'
import type { SerializedCast, SerializedTemplate } from '@/types'

type UseStudioComposerBridgeArgs = {
  composerRef: MutableRefObject<ComposerPanelRef | null>
  allKnownCasts: SerializedCast[]
}

export function useStudioComposerBridge({ composerRef, allKnownCasts }: UseStudioComposerBridgeArgs) {
  const handleSelectDate = useCallback((date: Date) => {
    composerRef.current?.setScheduleDate(date)
  }, [composerRef])

  const handleSelectCast = useCallback((castId: string) => {
    const cast = allKnownCasts.find(c => c.id === castId)
    if (cast) {
      composerRef.current?.loadCast(cast)
    }
  }, [composerRef, allKnownCasts])

  const handleStartCast = useCallback(() => {
    composerRef.current?.startNewCast()
  }, [composerRef])

  const handleLoadTemplateFromPanel = useCallback((template: SerializedTemplate) => {
    composerRef.current?.loadCast({
      id: '',
      accountId: template.accountId,
      content: template.content,
      status: 'draft',
      scheduledAt: new Date().toISOString(),
      publishedAt: null,
      castHash: null,
      channelId: template.channelId,
      errorMessage: null,
      retryCount: 0,
      media: [],
      account: null,
      createdBy: null,
    })
  }, [composerRef])

  return {
    handleSelectDate,
    handleSelectCast,
    handleStartCast,
    handleLoadTemplateFromPanel,
  }
}
