'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, CheckCircle, XCircle, ExternalLink, User, List, CalendarDays } from 'lucide-react'
import { CalendarView } from '@/components/calendar/CalendarView'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Cast {
  id: string
  content: string
  status: string
  scheduledAt: Date
  castHash: string | null
  account: { username: string; pfpUrl: string | null } | null
}

interface DashboardContentProps {
  stats: {
    scheduled: number
    today: number
    published: number
    failed: number
  }
  recentCasts: Cast[]
  allCasts: Cast[]
  accountsCount: number
}

export function DashboardContent({ stats, recentCasts, allCasts, accountsCount }: DashboardContentProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const handleMoveCast = async (castId: string, newDate: Date) => {
    try {
      const res = await fetch(`/api/casts/${castId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      })

      if (!res.ok) {
        throw new Error('Failed to update cast')
      }

      // Recargar la página para ver los cambios
      window.location.reload()
    } catch (error) {
      console.error('Error moving cast:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Resumen de actividad de {accountsCount} cuenta{accountsCount !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* View toggle */}
        <div className="flex items-center bg-gray-100/50 p-1 rounded-lg border border-gray-200/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('list')}
            className={cn(
              "h-8 text-xs font-medium",
              view === 'list' && "bg-white shadow-sm text-gray-900"
            )}
          >
            <List className="w-3.5 h-3.5 mr-2" />
            Lista
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('calendar')}
            className={cn(
              "h-8 text-xs font-medium",
              view === 'calendar' && "bg-white shadow-sm text-gray-900"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5 mr-2" />
            Calendario
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          href="/dashboard/scheduled?status=scheduled"
          icon={<Clock className="w-5 h-5" />}
          label="Programados"
          value={stats.scheduled}
          color="text-blue-600 bg-blue-50 border-blue-100"
        />
        <StatCard
          href="/dashboard/scheduled?status=today"
          icon={<Calendar className="w-5 h-5" />}
          label="Para hoy"
          value={stats.today}
          color="text-purple-600 bg-purple-50 border-purple-100"
        />
        <StatCard
          href="/dashboard/scheduled?status=published"
          icon={<CheckCircle className="w-5 h-5" />}
          label="Publicados"
          value={stats.published}
          color="text-green-600 bg-green-50 border-green-100"
        />
        <StatCard
          href="/dashboard/scheduled?status=failed"
          icon={<XCircle className="w-5 h-5" />}
          label="Fallidos"
          value={stats.failed}
          color="text-red-600 bg-red-50 border-red-100"
        />
      </div>

      {/* Content based on view */}
      {view === 'list' ? (
        <Card className="overflow-hidden border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
            <h2 className="font-semibold text-lg tracking-tight">Actividad reciente</h2>
            <Button variant="link" asChild className="text-castor-black h-auto p-0">
              <Link href="/dashboard/scheduled">
                Ver todos
              </Link>
            </Button>
          </div>
          <div className="p-6">
            {recentCasts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6 text-gray-400" />
                </div>
                <p className="font-medium text-gray-900">No hay actividad reciente</p>
                <p className="text-sm mt-1">Los casts programados aparecerán aquí</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentCasts.map((cast) => (
                  <RecentCastItem key={cast.id} cast={cast} />
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6 shadow-sm">
          <CalendarView casts={allCasts} onMoveCast={handleMoveCast} />
        </Card>
      )}
    </div>
  )
}

function RecentCastItem({ cast }: { cast: Cast }) {
  const statusStyles = {
    scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
    publishing: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    published: 'bg-green-50 text-green-700 border-green-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
    draft: 'bg-gray-50 text-gray-700 border-gray-100',
  }

  const statusLabels = {
    scheduled: 'Programado',
    publishing: 'Publicando',
    published: 'Publicado',
    failed: 'Fallido',
    draft: 'Borrador',
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100">
      {cast.account?.pfpUrl ? (
        <img src={cast.account.pfpUrl} alt="" className="w-10 h-10 rounded-full border border-gray-100" />
      ) : (
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <User className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{cast.content}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          @{cast.account?.username} · {new Date(cast.scheduledAt).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <span className={cn(
        "text-xs px-2.5 py-0.5 rounded-full font-medium border",
        statusStyles[cast.status as keyof typeof statusStyles] || 'bg-gray-50 text-gray-600 border-gray-100'
      )}>
        {statusLabels[cast.status as keyof typeof statusLabels] || cast.status}
      </span>
      {cast.status === 'published' && cast.castHash && (
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
          <a
            href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver en Warpcast"
          >
            <ExternalLink className="w-4 h-4 text-gray-400 hover:text-castor-black" />
          </a>
        </Button>
      )}
    </div>
  )
}

function StatCard({
  href,
  icon,
  label,
  value,
  color,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <Link href={href}>
      <Card className="p-5 hover:shadow-md transition-all duration-200 border-gray-200 hover:border-gray-300 group cursor-pointer h-full">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-xl border", color)}>{icon}</div>
          <div>
            <p className="text-3xl font-display text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">{label}</p>
          </div>
        </div>
      </Card>
    </Link>
  )
}
