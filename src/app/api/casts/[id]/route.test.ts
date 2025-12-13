import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getSessionMock, dbMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      scheduledCasts: {
        findFirst: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
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

import { GET } from './route'

describe('/api/casts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const res = await GET({} as any, { params: Promise.resolve({ id: 'cast-1' }) })
    expect(res).toBeDefined()
    if (!res) throw new Error('Expected Response')
    expect(res.status).toBe(401)
  })

  it('does not leak sensitive account fields', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.scheduledCasts.findFirst.mockResolvedValueOnce({
      id: 'cast-1',
      accountId: 'acc-1',
      status: 'scheduled',
      scheduledAt: new Date(),
      account: {
        id: 'acc-1',
        username: 'alice',
        displayName: 'Alice',
        pfpUrl: null,
        ownerId: 'u1',
        signerUuid: 'SECRET',
      },
      media: [],
    })

    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce(null)

    const res = await GET({} as any, { params: Promise.resolve({ id: 'cast-1' }) })
    expect(res).toBeDefined()
    if (!res) throw new Error('Expected Response')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data?.cast?.account?.username).toBe('alice')
    expect(body.data?.cast?.account?.ownerId).toBeUndefined()
    expect(body.data?.cast?.account?.signerUuid).toBeUndefined()
  })
})
