'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type DexScreenerPair = {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  priceUsd?: string
  priceNative?: string
  volume?: Record<string, number>
  priceChange?: Record<string, number>
  liquidity?: { usd?: number; base?: number; quote?: number }
  fdv?: number
  marketCap?: number
}

type DexScreenerSearchResponse = {
  schemaVersion?: string
  pairs?: DexScreenerPair[]
}

type DexScreenerPairResponse = {
  schemaVersion?: string
  pairs?: DexScreenerPair[]
}

type ClankerToken = {
  contract_address: string
  name: string
  symbol: string
  chain_id: number
  pool_address?: string
}

type ClankerTokensResponse = {
  data?: ClankerToken[]
  total?: number
  cursor?: string
}

type GeckoTerminalOhlcvResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: number[][]
    }
  }
}

type TickerDrawerContextValue = {
  openTicker: (ticker: string) => void
}

const TickerDrawerContext = createContext<TickerDrawerContextValue | undefined>(undefined)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const parsePriceUsd = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(value)

const formatCompactUsd = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value)

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)

const getEmbedUrl = (baseUrl: string, theme: 'dark' | 'light') => {
  const hasQuery = baseUrl.includes('?')
  const join = hasQuery ? '&' : '?'
  return `${baseUrl}${join}embed=1&theme=${theme}`
}

const getPairScore = (pair: DexScreenerPair) => {
  const liquidityUsd = pair.liquidity?.usd
  const volume24h = pair.volume?.h24

  const liquidityScore = isFiniteNumber(liquidityUsd) ? liquidityUsd : 0
  const volumeScore = isFiniteNumber(volume24h) ? volume24h : 0

  return liquidityScore * 10 + volumeScore
}

const normalizeTicker = (ticker: string) => ticker.trim().replace(/^\$+/, '').toUpperCase()

const normalizeAddress = (value: string | undefined | null) => {
  const v = (value ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return null
  return v.toLowerCase()
}

const pickBestClankerToken = (tokens: ClankerToken[], tickerUpper: string) => {
  const baseTokens = tokens.filter((t) => t.chain_id === 8453)
  if (baseTokens.length === 0) return null

  const exactSymbol = baseTokens.filter((t) => t.symbol?.toUpperCase() === tickerUpper)
  if (exactSymbol.length > 0) return exactSymbol[0] ?? null

  const byName = baseTokens.filter((t) => t.name?.toUpperCase() === tickerUpper)
  if (byName.length > 0) return byName[0] ?? null

  return baseTokens[0] ?? null
}

const buildSparklinePath = (values: number[], width: number, height: number, padding: number) => {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)

  const safeRange = max - min
  const range = safeRange === 0 ? 1 : safeRange

  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * innerW
    const normalized = (v - min) / range
    const y = padding + (1 - normalized) * innerH
    return { x, y }
  })

  const d = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return { d, min, max }
}

export function TickerDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [ticker, setTicker] = useState<string | null>(null)
  const [pairs, setPairs] = useState<DexScreenerPair[]>([])
  const [selectedPairAddress, setSelectedPairAddress] = useState<string | null>(null)
  const [resolvedPoolAddress, setResolvedPoolAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sparkline, setSparkline] = useState<{ close: number[] } | null>(null)
  const [sparklineLoading, setSparklineLoading] = useState(false)

  const [embedTheme, setEmbedTheme] = useState<'dark' | 'light'>('dark')

  const selectedPair = useMemo(() => {
    if (!selectedPairAddress) return null
    return pairs.find((p) => p.pairAddress === selectedPairAddress) ?? null
  }, [pairs, selectedPairAddress])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const openTicker = useCallback(async (rawTicker: string) => {
    const normalized = normalizeTicker(rawTicker)
    if (normalized.length < 2) return

    setTicker(normalized)
    setOpen(true)
    setIsLoading(true)
    setError(null)
    setPairs([])
    setSelectedPairAddress(null)
    setResolvedPoolAddress(null)
    setSparkline(null)

    try {
      const tickerUpper = normalized.toUpperCase()

      // 1) Clanker-first: resolve ticker -> Base token -> pool_address
      const clankerRes = await fetch(`/api/clanker/tokens?q=${encodeURIComponent(normalized)}&limit=20`)
      if (clankerRes.ok) {
        const clankerData = (await clankerRes.json()) as ClankerTokensResponse
        const clankerTokens = Array.isArray(clankerData.data) ? clankerData.data : []
        const bestToken = pickBestClankerToken(clankerTokens, tickerUpper)
        const poolAddress = normalizeAddress(bestToken?.pool_address)

        if (poolAddress) {
          setResolvedPoolAddress(poolAddress)
          const pairRes = await fetch(`/api/dexscreener/pair?chainId=base&pairId=${encodeURIComponent(poolAddress)}`)
          if (pairRes.ok) {
            const pairData = (await pairRes.json()) as DexScreenerPairResponse
            const pairList = Array.isArray(pairData.pairs) ? pairData.pairs : []
            if (pairList.length > 0) {
              setPairs(pairList)
              setSelectedPairAddress(pairList[0]?.pairAddress ?? null)
              setIsLoading(false)
              return
            }
          }
        }
      }

      // 2) Fallback: DexScreener search
      const res = await fetch(`/api/dexscreener/search?q=${encodeURIComponent(normalized)}`)
      if (!res.ok) {
        setError('Failed to load token data')
        setIsLoading(false)
        return
      }

      const data = (await res.json()) as DexScreenerSearchResponse
      const allPairs = Array.isArray(data.pairs) ? data.pairs : []

      const basePairs = allPairs.filter((p) => p.chainId?.toLowerCase() === 'base')
      const baseMatching = basePairs.filter((p) => {
        const baseSymbol = p.baseToken?.symbol?.toUpperCase()
        const quoteSymbol = p.quoteToken?.symbol?.toUpperCase()
        return baseSymbol === tickerUpper || quoteSymbol === tickerUpper
      })

      const anyChainMatching = allPairs.filter((p) => {
        const baseSymbol = p.baseToken?.symbol?.toUpperCase()
        const quoteSymbol = p.quoteToken?.symbol?.toUpperCase()
        return baseSymbol === tickerUpper || quoteSymbol === tickerUpper
      })

      const candidates = baseMatching.length > 0 ? baseMatching : anyChainMatching.length > 0 ? anyChainMatching : allPairs

      const list = candidates
        .slice()
        .sort((a, b) => getPairScore(b) - getPairScore(a))
        .slice(0, 5)

      setPairs(list)
      setSelectedPairAddress(list[0]?.pairAddress ?? null)
      setIsLoading(false)
    } catch {
      setError('Failed to load token data')
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (!resolvedPoolAddress) return

    let didCancel = false

    const run = async () => {
      setSparklineLoading(true)
      try {
        const res = await fetch(
          `/api/geckoterminal/ohlcv?network=base&poolAddress=${encodeURIComponent(resolvedPoolAddress)}&timeframe=hour&aggregate=1&limit=96&currency=usd`
        )
        if (!res.ok) {
          if (!didCancel) setSparkline(null)
          if (!didCancel) setSparklineLoading(false)
          return
        }

        const data = (await res.json()) as GeckoTerminalOhlcvResponse
        const list = data.data?.attributes?.ohlcv_list
        if (!Array.isArray(list) || list.length === 0) {
          if (!didCancel) setSparkline(null)
          if (!didCancel) setSparklineLoading(false)
          return
        }

        // ohlcv_list item: [timestamp, open, high, low, close, volume]
        const close = list
          .map((row) => (Array.isArray(row) ? row[4] : null))
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
          .slice()
          .reverse()

        if (!didCancel) setSparkline({ close })
        if (!didCancel) setSparklineLoading(false)
      } catch {
        if (!didCancel) setSparkline(null)
        if (!didCancel) setSparklineLoading(false)
      }
    }

    run()

    return () => {
      didCancel = true
    }
  }, [open, resolvedPoolAddress])

  useEffect(() => {
    if (!open) return

    const updateTheme = () => {
      const isAppDark = document.documentElement.classList.contains('dark')
      setEmbedTheme(isAppDark ? 'light' : 'dark')
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      observer.disconnect()
    }
  }, [open])

  const value = useMemo<TickerDrawerContextValue>(() => ({ openTicker }), [openTicker])

  const headerTitle = ticker ? `$${ticker}` : 'Token'

  const farcasterUrl = ticker ? `https://farcaster.xyz/~/token/${ticker.toLowerCase()}` : null
  const dexUrl = selectedPair?.url ?? null

  const priceUsd = parsePriceUsd(selectedPair?.priceUsd)
  const priceChange24h = selectedPair?.priceChange?.h24
  const volume24h = selectedPair?.volume?.h24
  const liquidityUsd = selectedPair?.liquidity?.usd
  const marketCap = selectedPair?.marketCap
  const fdv = selectedPair?.fdv

  return (
    <TickerDrawerContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[20vw] sm:min-w-[320px] sm:max-w-[520px] overflow-y-auto scrollbar-none p-4 sm:p-5 font-mono tracking-tight shadow-none border-l-2 border-border"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{headerTitle}</SheetTitle>
          </SheetHeader>

          <div className="flex items-start justify-between gap-3 border-b-2 border-border pb-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{headerTitle}</h2>
              {selectedPair && (
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">
                  {selectedPair.baseToken.symbol}/{selectedPair.quoteToken.symbol} · {selectedPair.dexId} · {selectedPair.chainId}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {dexUrl && (
                <a
                  href={dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 inline-flex items-center gap-2 border-2 border-border bg-transparent hover:bg-accent transition-colors text-[10px] uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open on DexScreener"
                >
                  <ExternalLink className="w-4 h-4" />
                  Dex
                </a>
              )}
              {farcasterUrl && (
                <a
                  href={farcasterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 inline-flex items-center gap-2 border-2 border-border bg-transparent hover:bg-accent transition-colors text-[10px] uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open on Farcaster"
                >
                  <ExternalLink className="w-4 h-4" />
                  Farcaster
                </a>
              )}
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-sm text-muted-foreground py-6">{error}</div>
            ) : pairs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6">No pools found.</div>
            ) : (
              <>
                <div className="border-2 border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Price (last 96h)</p>
                    {sparklineLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>

                  {sparkline?.close && sparkline.close.length >= 2 ? (() => {
                    const width = 240
                    const height = 64
                    const padding = 6
                    const built = buildSparklinePath(sparkline.close, width, height, padding)
                    if (!built) return null
                    const last = sparkline.close[sparkline.close.length - 1]
                    const first = sparkline.close[0]
                    const isUp = last >= first
                    return (
                      <div className="mt-2">
                        <svg
                          viewBox={`0 0 ${width} ${height}`}
                          className="w-full h-16"
                          role="img"
                          aria-label="Price sparkline"
                        >
                          <path
                            d={built.d}
                            fill="none"
                            stroke={isUp ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
                          Min {formatUsd(built.min)} · Max {formatUsd(built.max)}
                        </p>
                      </div>
                    )
                  })() : (
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">No chart data available.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  {priceUsd !== null && (
                    <div className="border-2 border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Price</p>
                      <p className="text-base sm:text-lg font-semibold mt-1 tabular-nums">{formatUsd(priceUsd)}</p>
                    </div>
                  )}

                  {isFiniteNumber(priceChange24h) && (
                    <div className="border-2 border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Price change (24h)</p>
                      <p
                        className={cn(
                          'text-base sm:text-lg font-semibold mt-1 tabular-nums',
                          priceChange24h >= 0 ? 'text-primary' : 'text-destructive'
                        )}
                      >
                        {priceChange24h.toFixed(2)}%
                      </p>
                    </div>
                  )}

                  {isFiniteNumber(volume24h) && (
                    <div className="border-2 border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Volume (24h)</p>
                      <p className="text-base sm:text-lg font-semibold mt-1 tabular-nums">{formatCompactUsd(volume24h)}</p>
                    </div>
                  )}

                  {isFiniteNumber(liquidityUsd) && (
                    <div className="border-2 border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Liquidity</p>
                      <p className="text-base sm:text-lg font-semibold mt-1 tabular-nums">{formatCompactUsd(liquidityUsd)}</p>
                    </div>
                  )}

                  {isFiniteNumber(marketCap) && (
                    <div className="border-2 border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Market cap</p>
                      <p className="text-base sm:text-lg font-semibold mt-1 tabular-nums">{formatCompactUsd(marketCap)}</p>
                    </div>
                  )}

                  {isFiniteNumber(fdv) && (
                    <div className="border-2 border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">FDV</p>
                      <p className="text-base sm:text-lg font-semibold mt-1 tabular-nums">{formatCompactUsd(fdv)}</p>
                    </div>
                  )}
                </div>

                {pairs.length > 1 && (
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Top pools</p>
                    <div className="mt-2 grid gap-2">
                      {pairs.map((p) => {
                        const isSelected = p.pairAddress === selectedPairAddress
                        const liq = p.liquidity?.usd
                        return (
                          <button
                            key={p.pairAddress}
                            type="button"
                            onClick={() => setSelectedPairAddress(p.pairAddress)}
                            className={cn(
                              'w-full text-left border-2 px-3 py-2 transition-colors bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isSelected ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                            )}
                            aria-label={`Select pool ${p.baseToken.symbol}/${p.quoteToken.symbol}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium truncate">
                                {p.baseToken.symbol}/{p.quoteToken.symbol}
                                <span className="text-muted-foreground"> · {p.chainId}</span>
                              </p>
                              {isFiniteNumber(liq) && (
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Liq {formatCompactNumber(liq)}</p>
                              )}
                            </div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">{p.dexId}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedPair?.url && (
                  <div className="mt-6 overflow-hidden border-2 border-border bg-background">
                    <div className="relative w-full aspect-[20/13]">
                      <iframe
                        src={getEmbedUrl(selectedPair.url, embedTheme)}
                        className="absolute inset-0 h-full w-full border-0"
                        allow="clipboard-write; web-share"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                        title={`${headerTitle} chart`}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="w-full h-10 border-2 border-border bg-background text-foreground hover:bg-accent transition-colors text-[10px] uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Close
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </TickerDrawerContext.Provider>
  )
}

export function useTickerDrawer() {
  const context = useContext(TickerDrawerContext)
  if (!context) {
    throw new Error('useTickerDrawer must be used within a TickerDrawerProvider')
  }
  return context
}
