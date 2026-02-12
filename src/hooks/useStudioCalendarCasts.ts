import { useMemo } from 'react'
import type { SerializedCast } from '@/types'

type UseStudioCalendarCastsArgs = {
  casts: SerializedCast[]
}

export function useStudioCalendarCasts({ casts }: UseStudioCalendarCastsArgs) {
  return useMemo(
    () =>
      casts.map((c) => ({
        id: c.id,
        content: c.content || '',
        status: c.status,
        scheduledAt: new Date(c.status === 'published' && c.publishedAt ? c.publishedAt : c.scheduledAt),
        network: c.network,
        publishTargets: c.publishTargets,
        account: c.account ? { username: c.account.username, pfpUrl: c.account.pfpUrl } : null,
      })),
    [casts]
  )
}
