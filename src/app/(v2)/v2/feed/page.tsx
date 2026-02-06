import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FeedV2Client } from './FeedV2Client'

export const dynamic = 'force-dynamic'

export default async function FeedV2Page() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <FeedV2Client
      user={{
        username: session.username,
        displayName: session.displayName,
        pfpUrl: session.pfpUrl,
      }}
    />
  )
}
