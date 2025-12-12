import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getSessionMock, dbMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      accounts: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({ values: vi.fn() })),
  }

  return {
    getSessionMock: vi.fn(),
    dbMock: db,
  }
})

vi.mock('@/lib/auth', () => ({
  getSession: getSessionMock,
}))

vi.mock('@/lib/db', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    db: dbMock,
  }
})

import { GET, POST } from './route'

describe('/api/accounts/[id]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const res = await GET({} as any, { params: Promise.resolve({ id: 'acc-1' }) })
    expect(res.status).toBe(401)
  })

  it('GET returns 403 when cannot view members', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'other' })
    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce(null)

    const res = await GET({} as any, { params: Promise.resolve({ id: 'acc-1' }) })
    expect(res.status).toBe(403)
  })

  it('GET returns 409 when account is personal', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst
      .mockResolvedValueOnce({ ownerId: 'u-owner' }) // canViewMembers
      .mockResolvedValueOnce({ type: 'personal' }) // account type check

    const res = await GET({} as any, { params: Promise.resolve({ id: 'acc-1' }) })
    expect(res.status).toBe(409)
  })

  it('POST returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const req = { json: async () => ({ username: 'alice' }) } as any
    const res = await POST(req, { params: Promise.resolve({ id: 'acc-1' }) })
    expect(res.status).toBe(401)
  })

  it('POST returns 403 when cannot manage members', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'other' })
    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce({ role: 'member' })

    const req = { json: async () => ({ username: 'alice' }) } as any
    const res = await POST(req, { params: Promise.resolve({ id: 'acc-1' }) })
    expect(res.status).toBe(403)
  })

  it('POST returns 404 when invited user does not exist', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner' })
    dbMock.query.users.findFirst.mockResolvedValueOnce(null)

    const req = { json: async () => ({ username: '@alice' }) } as any
    const res = await POST(req, { params: Promise.resolve({ id: 'acc-1' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(String(body.error)).toContain('User not found')
  })

  it('POST returns 409 when account is personal', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst
      .mockResolvedValueOnce({ ownerId: 'u-owner' }) // canManageMembers
      .mockResolvedValueOnce({ ownerId: 'u-owner', type: 'personal' }) // account type check

    dbMock.query.users.findFirst.mockResolvedValueOnce({
      id: 'u2',
      username: 'alice',
      displayName: null,
      pfpUrl: null,
    })

    const req = { json: async () => ({ username: 'alice' }) } as any
    const res = await POST(req, { params: Promise.resolve({ id: 'acc-1' }) })

    expect(res.status).toBe(409)
  })

  it('POST returns 409 when user is already a member', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst
      .mockResolvedValueOnce({ ownerId: 'u-owner' }) // canManageMembers
      .mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' }) // account exists check

    dbMock.query.users.findFirst.mockResolvedValueOnce({
      id: 'u2',
      username: 'alice',
      displayName: null,
      pfpUrl: null,
    })

    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce({ id: 'm-existing' }) // existing membership check

    const req = { json: async () => ({ username: 'alice' }) } as any
    const res = await POST(req, { params: Promise.resolve({ id: 'acc-1' }) })

    expect(res.status).toBe(409)
  })

  it('POST returns 201 and member when successful', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst
      .mockResolvedValueOnce({ ownerId: 'u-owner' }) // canManageMembers
      .mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' }) // account exists check

    dbMock.query.users.findFirst.mockResolvedValueOnce({
      id: 'u2',
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: null,
    })

    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // existing membership check
      .mockResolvedValueOnce({
        id: 'm-new',
        accountId: 'acc-1',
        userId: 'u2',
        role: 'member',
        canEditContext: false,
        user: {
          id: 'u2',
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: null,
        },
      }) // fetch inserted member

    const valuesMock = vi.fn()
    dbMock.insert.mockReturnValueOnce({ values: valuesMock })

    const req = { json: async () => ({ username: 'alice', role: 'member', canEditContext: false }) } as any
    const res = await POST(req, { params: Promise.resolve({ id: 'acc-1' }) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.member?.id).toBe('m-new')
    expect(valuesMock).toHaveBeenCalledTimes(1)
  })
})
