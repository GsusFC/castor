import { beforeEach, describe, expect, it, vi } from 'vitest'

const { publishDueCastsMock } = vi.hoisted(() => ({
  publishDueCastsMock: vi.fn(),
}))

const { withLockMock } = vi.hoisted(() => ({
  withLockMock: vi.fn(),
}))

const { dbMock, cronRunsMock } = vi.hoisted(() => {
  const valuesMock = vi.fn()
  const whereMock = vi.fn()
  const setMock = vi.fn(() => ({ where: whereMock }))

  const insertMock = vi.fn(() => ({ values: valuesMock }))
  const updateMock = vi.fn(() => ({ set: setMock }))

  return {
    dbMock: {
      insert: insertMock,
      update: updateMock,
    },
    cronRunsMock: { id: 'id' },
  }
})

vi.mock('@/lib/publisher', () => ({
  publishDueCasts: publishDueCastsMock,
}))

vi.mock('@/lib/lock', () => ({
  withLock: withLockMock,
}))

vi.mock('@/lib/db', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    db: dbMock,
    cronRuns: cronRunsMock,
  }
})

import { GET } from './route'

const buildRequest = (headers?: Record<string, string>) => ({
  headers: {
    get: (key: string) => headers?.[key.toLowerCase()] || null,
  },
}) as any

describe('/api/cron/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records cron run and returns success payload', async () => {
    withLockMock.mockImplementation(async (_key: string, fn: () => Promise<any>) => {
      const result = await fn()
      return { success: true as const, result }
    })

    publishDueCastsMock.mockResolvedValue({
      published: 1,
      failed: 0,
      retrying: 0,
      skipped: 0,
      processed: 1,
    })

    const res = await GET(buildRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.published).toBe(1)

    expect(dbMock.insert).toHaveBeenCalledOnce()
    expect(dbMock.update).toHaveBeenCalled()
  })

  it('records failed run when publish throws', async () => {
    withLockMock.mockImplementation(async (_key: string, fn: () => Promise<any>) => {
      await fn()
      return { success: true as const, result: null }
    })

    publishDueCastsMock.mockRejectedValue(new Error('boom'))

    const res = await GET(buildRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to publish casts')
    expect(dbMock.update).toHaveBeenCalled()
  })

  it('stores netlify source when header is provided', async () => {
    withLockMock.mockResolvedValue({
      success: false,
      reason: 'locked',
    })

    const res = await GET(buildRequest({ 'x-cron-source': 'netlify-scheduled' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.skipped).toBe(true)
    expect(dbMock.insert).toHaveBeenCalledOnce()
  })
})
