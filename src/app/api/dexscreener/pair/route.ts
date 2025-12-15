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

    const chainIdRaw = searchParams.get('chainId')
    const pairIdRaw = searchParams.get('pairId')

    const chainId = (chainIdRaw ?? '').trim()
    const pairId = (pairIdRaw ?? '').trim()

    if (!chainId || !pairId) {
      return NextResponse.json({ error: 'Missing chainId or pairId' }, { status: 400 })
    }

    const key = `${chainId.toLowerCase()}|${pairId.toLowerCase()}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(chainId)}/${encodeURIComponent(pairId)}`,
      {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
        },
      }
    ).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch DexScreener data' }, { status: 502 })
    }

    const payload = (await res.json()) as unknown

    cache.set(key, { payload, expiresAt: Date.now() + TTL_MS })

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch DexScreener data' }, { status: 500 })
  }
}
