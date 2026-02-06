'use client'

import { AppHeader } from '@/components/v2/AppHeader'
import { Rss } from 'lucide-react'

interface FeedV2ClientProps {
  user: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
}

export function FeedV2Client({ user }: FeedV2ClientProps) {
  return (
    <>
      <AppHeader user={user} unreadNotifications={0} />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Rss className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Feed coming soon</p>
          <p className="text-xs text-muted-foreground">
            The v2 feed will be available here. For now, use the v1 feed.
          </p>
        </div>
      </main>
    </>
  )
}
