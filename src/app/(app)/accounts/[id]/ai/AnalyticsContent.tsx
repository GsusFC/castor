'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Heart, Repeat2, MessageCircle, TrendingUp, Loader2, Download, Sparkles, Clock, CalendarDays, Lightbulb, Send, MessageSquare, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type PeriodFilter = 7 | 30 | 90

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnalyticsContentProps {
  accountId: string
}

export function AnalyticsContent({ accountId }: AnalyticsContentProps) {
  const [period, setPeriod] = useState<PeriodFilter>(30)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [forceRefreshInsights, setForceRefreshInsights] = useState(false)
  const [isBrandModeOn, setIsBrandModeOn] = useState<boolean | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    let isActive = true
    const loadBrandMode = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/context`)
        const data = res.ok ? await res.json() : null
        const brandVoice = (data?.knowledgeBase?.brandVoice as string | undefined) ?? ''
        if (!isActive) return
        setIsBrandModeOn(brandVoice.trim().length > 0)
      } catch {
        if (!isActive) return
        setIsBrandModeOn(false)
      }
    }

    loadBrandMode()
    return () => {
      isActive = false
    }
  }, [accountId])

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/analytics/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, limit: 100 }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to backfill')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} casts from @${data.account.username}`)
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error importing')
    },
  })

  const analyticsQuery = useQuery({
    queryKey: ['analytics', accountId, period],
    queryFn: async () => {
      const queryParams = new URLSearchParams({ days: period.toString(), accountId })
      const res = await fetch(`/api/analytics?${queryParams}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
  })

  const data = analyticsQuery.data
  const isLoading = analyticsQuery.isLoading

  const insightsQuery = useQuery({
    queryKey: ['analytics-insights', accountId, forceRefreshInsights],
    queryFn: async () => {
      const queryParams = new URLSearchParams({ accountId })
      if (forceRefreshInsights) queryParams.set('refresh', 'true')

      const res = await fetch(`/api/analytics/insights?${queryParams}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to fetch insights')
      }
      const result = await res.json()
      if (forceRefreshInsights) setForceRefreshInsights(false)
      return result
    },
    enabled: (data?.totals?.casts || 0) >= 5,
    staleTime: 1000 * 60 * 60,
  })

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
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
      toast.error(err.message || 'Error processing question')
    },
  })

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatMutation.isPending) return
    chatMutation.mutate(chatInput.trim())
  }

  const accountUsername = data?.accounts?.find((a: { id: string }) => a.id === accountId)?.username

  return (
    <div className="space-y-6">
      {/* Period filter + Import */}
      <div className="flex items-center justify-between gap-3">
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
          onClick={() => backfillMutation.mutate()}
          disabled={backfillMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          title="Import last 100 casts"
        >
          {backfillMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Import
        </button>
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
              label="Replies"
              value={data?.totals?.replies || 0}
              color="text-purple-500"
            />
          </div>

          {/* AI Chat */}
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {isBrandModeOn === false && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Enable AI Brand Mode by completing your Brand Voice.
                </p>
              </div>
            )}

            {/* Messages bubble */}
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
                      {accountUsername && `@${accountUsername}`}
                      {insightsQuery.data?.cached && (
                        <span className="ml-2 text-muted-foreground/60">
                          • Generated {new Date(insightsQuery.data.generatedAt).toLocaleDateString('en-US')}
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
                    title="Regenerate analysis"
                  >
                    <RefreshCw className={cn("w-4 h-4 text-muted-foreground", insightsQuery.isFetching && "animate-spin")} />
                  </button>
                )}
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {insightsQuery.isLoading ? (
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-background/60">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Analyzing your performance...</p>
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
                          ? 'You need at least 5 casts to generate insights. Use the "Import" button first.'
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
                      <div className="p-3 rounded-lg bg-background/60">
                        <p className="text-sm leading-relaxed">{insightsQuery.data.insights.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-lg bg-background/60 border border-border/50">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <p className="text-xs text-muted-foreground">Best hours</p>
                          </div>
                          <p className="text-sm font-semibold">{insightsQuery.data.insights.bestHours?.join(', ') || '-'}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/60 border border-border/50">
                          <div className="flex items-center gap-2 mb-1">
                            <CalendarDays className="w-3.5 h-3.5 text-green-500" />
                            <p className="text-xs text-muted-foreground">Best days</p>
                          </div>
                          <p className="text-sm font-semibold">{insightsQuery.data.insights.bestDays?.slice(0, 2).join(', ') || '-'}</p>
                        </div>
                      </div>

                      {insightsQuery.data.insights.recommendations?.length > 0 && (
                        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
                            <p className="text-xs font-medium">Recommendations</p>
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

                {/* Chat history */}
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

            {/* Input bubble */}
            <div className="rounded-xl border border-border bg-card p-4 flex-shrink-0">
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your analytics..."
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
