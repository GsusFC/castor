'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Heart, Repeat2, MessageCircle, TrendingUp, Loader2, Calendar, Download, Sparkles, Clock, CalendarDays, Lightbulb, Send, MessageSquare, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

type PeriodFilter = 7 | 30 | 90

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function AnalyticsPage() {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>(30)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [forceRefreshInsights, setForceRefreshInsights] = useState(false)
  const queryClient = useQueryClient()

  // Limpiar historial de chat cuando cambia la cuenta
  useEffect(() => {
    setChatHistory([])
    setChatInput('')
    setForceRefreshInsights(false)
  }, [selectedAccount])

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

  // AI Insights query
  const insightsQuery = useQuery({
    queryKey: ['analytics-insights', selectedAccount, forceRefreshInsights],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedAccount) params.set('accountId', selectedAccount)
      if (forceRefreshInsights) params.set('refresh', 'true')

      const res = await fetch(`/api/analytics/insights?${params}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to fetch insights')
      }
      const result = await res.json()
      // Reset force refresh después de obtener datos
      if (forceRefreshInsights) setForceRefreshInsights(false)
      return result
    },
    enabled: !!selectedAccount && (data?.totals?.casts || 0) >= 5,
    staleTime: 1000 * 60 * 60, // 1 hora (el cache real está en servidor)
  })

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          insights: insightsQuery.data?.insights || {},
          stats: insightsQuery.data?.stats || { totalCasts: 0, avgEngagement: 0 },
          topCasts: data?.topCasts?.slice(0, 5) || [],
          history: chatHistory,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to get response')
      }
      return res.json()
    },
    onSuccess: (response, question) => {
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: response.answer },
      ])
      setChatInput('')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error al procesar pregunta')
    },
  })

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatMutation.isPending) return
    chatMutation.mutate(chatInput.trim())
  }

  return (
    <div className="mx-auto w-full max-w-4xl xl:max-w-6xl">
      <div className="sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 sm:px-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Analytics</h1>
              <p className="text-sm text-muted-foreground">Rendimiento y engagement</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
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
        </div>
      </div>

      <div className="mt-6 space-y-6 px-4 sm:px-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Selector de cuenta */}
            {data?.accounts && data.accounts.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {selectedAccount ? 'Cuenta seleccionada' : 'Selecciona una cuenta'}
                  </h2>
                  {selectedAccount && (
                    <button
                      onClick={() => setSelectedAccount(null)}
                      className="text-xs text-primary hover:underline"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.accounts.map((account: any) => {
                    const isSelected = selectedAccount === account.id
                    return (
                      <button
                        key={account.id}
                        onClick={() => setSelectedAccount(isSelected ? null : account.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                          isSelected
                            ? "bg-primary/10 border-2 border-primary"
                            : "bg-muted/30 border-2 border-transparent hover:bg-muted/50"
                        )}
                      >
                        {account.pfpUrl ? (
                          <img
                            src={account.pfpUrl}
                            alt={account.username}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">@{account.username}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{account.stats.casts} casts</span>
                            <span className="flex items-center gap-0.5">
                              <Heart className="w-3 h-3 text-red-500" />
                              {account.stats.likes}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Repeat2 className="w-3 h-3 text-green-500" />
                              {account.stats.recasts}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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

            {/* AI Chat - Siempre visible cuando hay cuenta seleccionada */}
            {selectedAccount && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                {/* Burbuja de mensajes */}
                <div className="rounded-xl border border-border overflow-hidden flex flex-col flex-1 min-h-0 bg-card">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold">AI Analytics</h2>
                        <p className="text-xs text-muted-foreground">
                          @{data?.accounts?.find((a: any) => a.id === selectedAccount)?.username}
                          {insightsQuery.data?.cached && (
                            <span className="ml-2 text-muted-foreground/60">
                              • Generado {new Date(insightsQuery.data.generatedAt).toLocaleDateString('es-ES')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {insightsQuery.data && (
                      <button
                        onClick={() => setForceRefreshInsights(true)}
                        disabled={insightsQuery.isFetching}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                        title="Regenerar análisis"
                      >
                        <RefreshCw className={cn("w-4 h-4 text-muted-foreground", insightsQuery.isFetching && "animate-spin")} />
                      </button>
                    )}
                  </div>

                  {/* Área de mensajes - scrollable */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                    {/* Insights como primer mensaje de la IA */}
                    {insightsQuery.isLoading ? (
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 p-3 rounded-lg bg-background/60">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Analizando tu rendimiento...</p>
                          </div>
                        </div>
                      </div>
                    ) : insightsQuery.error ? (
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 p-3 rounded-lg bg-background/60">
                          <p className="text-sm text-muted-foreground">
                            {(data?.totals?.casts || 0) < 5
                              ? 'Necesitas al menos 5 casts para generar insights. Usa el botón "Importar" primero.'
                              : (insightsQuery.error as Error).message
                            }
                          </p>
                        </div>
                      </div>
                    ) : insightsQuery.data?.insights ? (
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-3">
                          {/* Summary */}
                          <div className="p-3 rounded-lg bg-background/60">
                            <p className="text-sm leading-relaxed">{insightsQuery.data.insights.summary}</p>
                          </div>

                          {/* Best times - Cards */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 rounded-lg bg-background/60 border border-border/50">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                <p className="text-xs text-muted-foreground">Mejores horas</p>
                              </div>
                              <p className="text-sm font-semibold">{insightsQuery.data.insights.bestHours?.join(', ') || '-'}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-background/60 border border-border/50">
                              <div className="flex items-center gap-2 mb-1">
                                <CalendarDays className="w-3.5 h-3.5 text-green-500" />
                                <p className="text-xs text-muted-foreground">Mejores días</p>
                              </div>
                              <p className="text-sm font-semibold">{insightsQuery.data.insights.bestDays?.slice(0, 2).join(', ') || '-'}</p>
                            </div>
                          </div>

                          {/* Recommendations */}
                          {insightsQuery.data.insights.recommendations?.length > 0 && (
                            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                                <p className="text-xs font-medium">Recomendaciones</p>
                              </div>
                              <ul className="space-y-1">
                                {insightsQuery.data.insights.recommendations.map((rec: string, i: number) => (
                                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <span className="text-yellow-500">→</span>
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Historial de chat */}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={cn("flex items-start gap-3", msg.role === 'user' && "flex-row-reverse")}>
                        <div className={cn(
                          "p-1.5 rounded-lg flex-shrink-0",
                          msg.role === 'user' ? "bg-primary/20" : "bg-primary/10"
                        )}>
                          {msg.role === 'user' ? (
                            <MessageSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className={cn(
                          "flex-1 p-3 rounded-lg text-sm whitespace-pre-wrap",
                          msg.role === 'user' ? "bg-primary/10" : "bg-background/60"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Burbuja de input - separada */}
                <div className="rounded-xl border border-border bg-card p-4 flex-shrink-0">
                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Pregunta sobre tu análisis..."
                      className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={chatMutation.isPending}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || chatMutation.isPending}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {chatMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
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
