import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getSessionMock, dbMock, publishCastMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      accounts: {
        findFirst: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ catch: vi.fn() })) })),
  }

  return {
    getSessionMock: vi.fn(),
    publishCastMock: vi.fn(),
    dbMock: db,
  }
})

const { withLockMock } = vi.hoisted(() => {
  return {
    withLockMock: vi.fn(async (_key: string, fn: () => Promise<any>) => {
      const result = await fn()
      return { success: true as const, result }
    }),
  }
})

const { idempotencyStore, getIdempotencyResponseMock, setIdempotencyResponseMock } = vi.hoisted(() => {
  const store = new Map<string, { status: number; data: unknown }>()
  return {
    idempotencyStore: store,
    getIdempotencyResponseMock: vi.fn(async (key: string) => store.get(key) ?? null),
    setIdempotencyResponseMock: vi.fn(async (key: string, value: { status: number; data: unknown }) => {
      store.set(key, value)
    }),
  }
})

vi.mock('@/lib/auth', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    getSession: getSessionMock,
  }
})

vi.mock('@/lib/db', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    db: dbMock,
  }
})

vi.mock('@/lib/farcaster/client', () => ({
  publishCast: publishCastMock,
}))

vi.mock('@/lib/lock', () => ({
  withLock: withLockMock,
}))

vi.mock('@/lib/idempotency', () => ({
  getIdempotencyResponse: getIdempotencyResponseMock,
  setIdempotencyResponse: setIdempotencyResponseMock,
}))

const { checkRateLimitMock } = vi.hoisted(() => {
  return {
    checkRateLimitMock: vi.fn(async () => ({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    })),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIP: () => 'test-ip',
}))

import { POST } from './route'

const assertResponse = <T extends Response | undefined>(res: T): Response => {
  if (!res) throw new Error('Expected route handler to return a Response')
  return res
}

describe('/api/casts/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    idempotencyStore.clear()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const req = {
      json: async () => ({ accountId: 'acc-1', content: 'hi' }),
      headers: { get: () => null },
    } as any
    const res = assertResponse(await POST(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 when accountId is missing', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    const req = { json: async () => ({ content: 'hi' }), headers: { get: () => null } } as any
    const res = assertResponse(await POST(req))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('Validation failed')
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'accountId', message: expect.any(String) }),
      ])
    )
  })

  it('returns 400 when content and embeds are missing', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    const req = { json: async () => ({ accountId: 'acc-1' }), headers: { get: () => null } } as any
    const res = assertResponse(await POST(req))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('Validation failed')
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'content', message: expect.stringContaining('content or embeds is required') }),
      ])
    )
  })

  it('returns 403 when cannot modify account', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({
      id: 'acc-1',
      ownerId: 'other',
      signerUuid: 'signer',
      signerStatus: 'approved',
    })

    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce(null)

    const req = {
      json: async () => ({ accountId: 'acc-1', content: 'hi' }),
      headers: { get: () => null },
    } as any
    const res = assertResponse(await POST(req))
    expect(res.status).toBe(403)
  })

  it('returns 200 when published', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({
      id: 'acc-1',
      ownerId: 'u1',
      signerUuid: 'signer',
      signerStatus: 'approved',
    })

    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce(null)

    publishCastMock.mockResolvedValueOnce({ success: true, hash: '0xhash', cast: { ok: true } })

    const req = {
      json: async () => ({ accountId: 'acc-1', content: 'hi' }),
      headers: { get: () => null },
    } as any
    const res = assertResponse(await POST(req))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.hash).toBe('0xhash')
  })

  it('replays response when idempotencyKey is reused', async () => {
    getSessionMock.mockResolvedValue({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValue({
      id: 'acc-1',
      ownerId: 'u1',
      signerUuid: 'signer',
      signerStatus: 'approved',
    })

    dbMock.query.accountMembers.findFirst.mockResolvedValue(null)

    publishCastMock.mockResolvedValueOnce({ success: true, hash: '0xhash', cast: { ok: true } })

    const req1 = {
      json: async () => ({ accountId: 'acc-1', content: 'hi', idempotencyKey: 'idem-123456' }),
      headers: { get: () => null },
    } as any

    const res1 = assertResponse(await POST(req1))
    expect(res1.status).toBe(200)

    const body1 = await res1.json()
    expect(body1.success).toBe(true)
    expect(body1.data.hash).toBe('0xhash')

    const req2 = {
      json: async () => ({ accountId: 'acc-1', content: 'hi', idempotencyKey: 'idem-123456' }),
      headers: { get: () => null },
    } as any

    const res2 = assertResponse(await POST(req2))
    expect(res2.status).toBe(200)

    const body2 = await res2.json()
    expect(body2.success).toBe(true)
    expect(body2.data.hash).toBe('0xhash')

    expect(publishCastMock).toHaveBeenCalledTimes(1)
  })
})
