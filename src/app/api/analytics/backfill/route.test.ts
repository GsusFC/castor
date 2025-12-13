import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getSessionMock, dbMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      accountMembers: {
        findMany: vi.fn(),
      },
      accounts: {
        findMany: vi.fn(),
      },
    },
  }

  return {
    getSessionMock: vi.fn(),
    dbMock: db,
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

import { POST } from './route'

describe('/api/analytics/backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const req = { json: async () => ({ accountId: 'acc-1', limit: 10 }) } as any
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when accountId is provided but not accessible', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accountMembers.findMany.mockResolvedValueOnce([{ accountId: 'acc-1' }])
    dbMock.query.accounts.findMany.mockResolvedValueOnce([{ id: 'acc-1', ownerId: 'u1' }])

    const req = { json: async () => ({ accountId: 'acc-2', limit: 10 }) } as any
    const res = await POST(req)
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(String(body.error)).toContain('Forbidden')
  })
})
