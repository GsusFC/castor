import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SettingsV2Client } from './SettingsV2Client'

export const dynamic = 'force-dynamic'

export default async function SettingsV2Page() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <SettingsV2Client
      user={{
        username: session.username,
        displayName: session.displayName,
        pfpUrl: session.pfpUrl,
      }}
    />
  )
}
