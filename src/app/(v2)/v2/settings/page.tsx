import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SettingsV2Page() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold mb-6">Configuration</h1>
      <p className="text-sm text-muted-foreground">Settings page — coming soon in v2.</p>
    </div>
  )
}
