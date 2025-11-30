import { db } from '@/lib/db'
import { DashboardContent } from './DashboardContent'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // Obtener estadísticas reales
  const allCasts = await db.query.scheduledCasts.findMany({
    with: { account: true },
    orderBy: (casts, { desc }) => [desc(casts.updatedAt)],
  })

  const accounts = await db.query.accounts.findMany()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const stats = {
    scheduled: allCasts.filter(c => c.status === 'scheduled').length,
    today: allCasts.filter(c => 
      c.status === 'scheduled' && 
      new Date(c.scheduledAt) >= todayStart && 
      new Date(c.scheduledAt) < todayEnd
    ).length,
    published: allCasts.filter(c => c.status === 'published').length,
    failed: allCasts.filter(c => c.status === 'failed').length,
  }

  const recentCasts = allCasts.slice(0, 5)

  // Serializar las fechas para el cliente
  const serializedCasts = allCasts.map(cast => ({
    ...cast,
    scheduledAt: cast.scheduledAt,
    account: cast.account ? {
      username: cast.account.username,
      pfpUrl: cast.account.pfpUrl,
    } : null,
  }))

  const serializedRecentCasts = recentCasts.map(cast => ({
    ...cast,
    scheduledAt: cast.scheduledAt,
    account: cast.account ? {
      username: cast.account.username,
      pfpUrl: cast.account.pfpUrl,
    } : null,
  }))

  return (
    <DashboardContent
      stats={stats}
      recentCasts={serializedRecentCasts}
      allCasts={serializedCasts}
      accountsCount={accounts.length}
    />
  )
}

