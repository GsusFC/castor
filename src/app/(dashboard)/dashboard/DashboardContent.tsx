'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, CheckCircle, XCircle, ExternalLink, User, List, CalendarDays } from 'lucide-react'
import { CalendarView } from '@/components/calendar/CalendarView'

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
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {accountsCount} cuenta{accountsCount !== 1 ? 's' : ''} conectada{accountsCount !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'calendar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Calendario
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          href="/dashboard/scheduled?status=scheduled"
          icon={<Clock className="w-5 h-5" />}
          label="Programados"
          value={stats.scheduled}
          color="text-blue-600 bg-blue-50"
        />
        <StatCard
          href="/dashboard/scheduled?status=today"
          icon={<Calendar className="w-5 h-5" />}
          label="Hoy"
          value={stats.today}
          color="text-purple-600 bg-purple-50"
        />
        <StatCard
          href="/dashboard/scheduled?status=published"
          icon={<CheckCircle className="w-5 h-5" />}
          label="Publicados"
          value={stats.published}
          color="text-green-600 bg-green-50"
        />
        <StatCard
          href="/dashboard/scheduled?status=failed"
          icon={<XCircle className="w-5 h-5" />}
          label="Fallidos"
          value={stats.failed}
          color="text-red-600 bg-red-50"
        />
      </div>

      {/* Content based on view */}
      {view === 'list' ? (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Actividad reciente</h2>
            <Link href="/dashboard/scheduled" className="text-sm text-castor-dark hover:underline">
              Ver todos
            </Link>
          </div>
          {recentCasts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay actividad reciente</p>
              <p className="text-sm mt-1">Los casts programados aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCasts.map((cast) => (
                <RecentCastItem key={cast.id} cast={cast} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <CalendarView casts={allCasts} onMoveCast={handleMoveCast} />
      )}
    </div>
  )
}

function RecentCastItem({ cast }: { cast: Cast }) {
  const statusColors = {
    scheduled: 'bg-blue-100 text-blue-700',
    publishing: 'bg-yellow-100 text-yellow-700',
    published: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
  }

  const statusLabels = {
    scheduled: 'Programado',
    publishing: 'Publicando',
    published: 'Publicado',
    failed: 'Fallido',
    draft: 'Borrador',
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      {cast.account?.pfpUrl ? (
        <img src={cast.account.pfpUrl} alt="" className="w-10 h-10 rounded-full" />
      ) : (
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{cast.content}</p>
        <p className="text-xs text-gray-500">
          @{cast.account?.username} · {new Date(cast.scheduledAt).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[cast.status as keyof typeof statusColors] || 'bg-gray-100'}`}>
        {statusLabels[cast.status as keyof typeof statusLabels] || cast.status}
      </span>
      {cast.status === 'published' && cast.castHash && (
        <a
          href={`https://warpcast.com/${cast.account?.username}/${cast.castHash.slice(0, 10)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </a>
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
    <Link
      href={href}
      className="bg-white rounded-xl border p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </Link>
  )
}
