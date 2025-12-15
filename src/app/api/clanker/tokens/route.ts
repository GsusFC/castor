import { NextRequest, NextResponse } from 'next/server'

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

const TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const qRaw = searchParams.get('q')
    const limitRaw = searchParams.get('limit')
    const includeMarketRaw = searchParams.get('includeMarket')

    const q = (qRaw ?? '').trim()
    if (q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    const limitParsed = Number(limitRaw)
    const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 20) : 20
    const includeMarket = includeMarketRaw === 'true'

    const key = `${q.toLowerCase()}|${limit}|${includeMarket}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const upstreamUrl = new URL('https://www.clanker.world/api/tokens')
    upstreamUrl.searchParams.set('q', q)
    upstreamUrl.searchParams.set('limit', String(limit))
    if (includeMarket) upstreamUrl.searchParams.set('includeMarket', 'true')

    const res = await fetch(upstreamUrl.toString(), {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch Clanker data' }, { status: 502 })
    }

    const payload = (await res.json()) as unknown

    cache.set(key, { payload, expiresAt: Date.now() + TTL_MS })

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Clanker data' }, { status: 500 })
  }
}
