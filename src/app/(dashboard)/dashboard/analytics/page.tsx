'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Heart, Repeat2, MessageCircle, TrendingUp, Loader2, Calendar, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

type PeriodFilter = 7 | 30 | 90

export default function AnalyticsPage() {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>(30)
  const queryClient = useQueryClient()

  // Backfill mutation - importa de la cuenta seleccionada o la primera disponible
  const backfillMutation = useMutation({
    mutationFn: async (accountId?: string | null) => {
      const res = await fetch('/api/analytics/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId || undefined, limit: 100 }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to backfill')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Importados ${data.imported} casts de @${data.account.username}`)
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error al importar')
    },
  })

  const analyticsQuery = useQuery({
    queryKey: ['analytics', selectedAccount, period],
    queryFn: async () => {
      const params = new URLSearchParams({ days: period.toString() })
      if (selectedAccount) params.set('accountId', selectedAccount)
      
      const res = await fetch(`/api/analytics?${params}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
  })

  const data = analyticsQuery.data
  const isLoading = analyticsQuery.isLoading

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Analytics</h1>
          <button
            onClick={() => backfillMutation.mutate(selectedAccount || undefined)}
            disabled={backfillMutation.isPending}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
            title="Importar últimos 100 casts"
          >
            {backfillMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            Importar
          </button>
        </div>
        
        {/* Filtros */}
        <div className="flex items-center gap-3">
          {/* Filtro por período */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {([7, 30, 90] as PeriodFilter[]).map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  period === d
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Filtro por cuenta */}
          <select
            value={selectedAccount || ''}
            onChange={(e) => setSelectedAccount(e.target.value || null)}
            className="px-3 py-1.5 text-sm bg-muted border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Todas ({data?.accounts?.length || 0})</option>
            {data?.accounts?.map((account: any) => (
              <option key={account.id} value={account.id}>
                @{account.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Casts"
              value={data?.totals?.casts || 0}
              color="text-blue-500"
            />
            <StatCard
              icon={<Heart className="w-5 h-5" />}
              label="Likes"
              value={data?.totals?.likes || 0}
              color="text-red-500"
            />
            <StatCard
              icon={<Repeat2 className="w-5 h-5" />}
              label="Recasts"
              value={data?.totals?.recasts || 0}
              color="text-green-500"
            />
            <StatCard
              icon={<MessageCircle className="w-5 h-5" />}
              label="Respuestas"
              value={data?.totals?.replies || 0}
              color="text-purple-500"
            />
          </div>

          {/* Por cuenta (si hay más de una) */}
          {data?.accounts && data.accounts.length > 1 && !selectedAccount && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Por cuenta
              </h2>
              <div className="space-y-3">
                {data.accounts.map((account: any) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {account.pfpUrl ? (
                        <img
                          src={account.pfpUrl}
                          alt={account.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted" />
                      )}
                      <span className="font-medium">@{account.username}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{account.stats.casts} casts</span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-red-500" />
                        {account.stats.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Repeat2 className="w-3.5 h-3.5 text-green-500" />
                        {account.stats.recasts}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Casts */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">
              🔥 Top Casts
            </h2>
            {data?.topCasts && data.topCasts.length > 0 ? (
              <div className="space-y-3">
                {data.topCasts.map((cast: any, index: number) => (
                  <div
                    key={cast.id}
                    className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2 mb-2">
                        {cast.content || '(sin contenido)'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-500" />
                          {cast.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 className="w-3 h-3 text-green-500" />
                          {cast.recasts}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-purple-500" />
                          {cast.replies}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(cast.publishedAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`https://warpcast.com/~/conversations/${cast.castHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Ver →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay casts registrados aún.</p>
                <p className="text-sm mt-1">
                  Los casts publicados con Castor aparecerán aquí.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={cn("mb-2", color)}>{icon}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}
