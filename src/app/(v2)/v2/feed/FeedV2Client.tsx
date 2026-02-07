'use client'

import Link from 'next/link'
import { AppHeader } from '@/components/v2/AppHeader'
import { Rss, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Rss className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-display font-semibold">Feed coming soon</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              The v2 feed is under construction. In the meantime, you can use the classic feed.
            </p>
          </div>
          <Button variant="outline" asChild className="mt-2">
            <Link href="/">
              Go to classic feed
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </main>
    </>
  )
}
