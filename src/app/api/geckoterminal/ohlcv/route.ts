import { NextRequest, NextResponse } from 'next/server'

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

const TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

const isValidAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const networkRaw = searchParams.get('network')
    const poolAddressRaw = searchParams.get('poolAddress')
    const timeframeRaw = searchParams.get('timeframe')
    const aggregateRaw = searchParams.get('aggregate')
    const limitRaw = searchParams.get('limit')
    const currencyRaw = searchParams.get('currency')

    const network = (networkRaw ?? '').trim().toLowerCase()
    const poolAddress = (poolAddressRaw ?? '').trim()
    const timeframe = (timeframeRaw ?? 'hour').trim().toLowerCase()

    if (!network) {
      return NextResponse.json({ error: 'Missing network' }, { status: 400 })
    }

    if (!poolAddress || !isValidAddress(poolAddress)) {
      return NextResponse.json({ error: 'Invalid poolAddress' }, { status: 400 })
    }

    if (timeframe !== 'day' && timeframe !== 'hour' && timeframe !== 'minute') {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
    }

    const aggregateParsed = Number(aggregateRaw)
    const aggregate = Number.isFinite(aggregateParsed) ? String(aggregateParsed) : '1'

    const limitParsed = Number(limitRaw)
    const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 10), 300) : 100

    const currency = currencyRaw === 'token' ? 'token' : 'usd'

    const key = `${network}|${poolAddress.toLowerCase()}|${timeframe}|${aggregate}|${limit}|${currency}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const upstreamUrl = new URL(
      `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(network)}/pools/${encodeURIComponent(poolAddress)}/ohlcv/${encodeURIComponent(timeframe)}`
    )

    upstreamUrl.searchParams.set('aggregate', aggregate)
    upstreamUrl.searchParams.set('limit', String(limit))
    upstreamUrl.searchParams.set('currency', currency)

    const res = await fetch(upstreamUrl.toString(), {
      signal: controller.signal,
      headers: {
        accept: 'application/json;version=20230203',
      },
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch GeckoTerminal data' }, { status: 502 })
    }

    const payload = (await res.json()) as unknown

    cache.set(key, { payload, expiresAt: Date.now() + TTL_MS })

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch GeckoTerminal data' }, { status: 500 })
  }
}
