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
      scheduledCasts: {
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

import { GET } from './route'

describe('/api/casts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const res = await GET({ url: 'https://example.com/api/casts' } as any)
    expect(res.status).toBe(401)
  })

  it('does not leak sensitive account fields', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accountMembers.findMany.mockResolvedValueOnce([{ accountId: 'acc-2' }])
    dbMock.query.accounts.findMany.mockResolvedValueOnce([{ id: 'acc-1' }, { id: 'acc-2' }])

    dbMock.query.scheduledCasts.findMany.mockResolvedValueOnce([
      {
        id: 'cast-1',
        accountId: 'acc-1',
        status: 'scheduled',
        scheduledAt: new Date(),
        account: {
          id: 'acc-1',
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: 'https://example.com/pfp.png',
          ownerId: 'u1',
          signerUuid: 'SECRET',
        },
      },
    ])

    const res = await GET({ url: 'https://example.com/api/casts' } as any)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.casts)).toBe(true)

    const cast = body.casts[0]
    expect(cast.account).toBeTruthy()
    expect(cast.account.username).toBe('alice')
    expect(cast.account.signerUuid).toBeUndefined()
    expect(cast.account.ownerId).toBeUndefined()
  })
})
