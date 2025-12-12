import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getSessionMock, dbMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      accounts: {
        findFirst: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
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

import { DELETE } from './route'

import { PATCH } from './route'

describe('/api/accounts/[id]/members/[memberId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when account not found', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'admin' })
    dbMock.query.accounts.findFirst.mockResolvedValueOnce(null)

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when account is personal (DELETE)', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'admin' })
    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u1', type: 'personal' })

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(409)
  })

  it('returns 403 when requester cannot manage', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce({ role: 'member' }) // requesterMembership

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when member not found', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // requesterMembership
      .mockResolvedValueOnce(null) // member

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when trying to remove account owner', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // requesterMembership
      .mockResolvedValueOnce({ id: 'm1', userId: 'u-owner', role: 'owner' }) // member

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 200 when removed', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // requesterMembership
      .mockResolvedValueOnce({ id: 'm1', userId: 'u2', role: 'member' }) // member

    const whereMock = vi.fn()
    dbMock.delete.mockReturnValueOnce({ where: whereMock })

    const res = await DELETE({} as any, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
    expect(whereMock).toHaveBeenCalledTimes(1)
  })

  it('PATCH returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const req = { json: async () => ({ role: 'admin' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(401)
  })

  it('PATCH returns 404 when account not found', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'admin' })
    dbMock.query.accounts.findFirst.mockResolvedValueOnce(null)

    const req = { json: async () => ({ role: 'admin' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(404)
  })

  it('PATCH returns 409 when account is personal', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'admin' })
    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u1', type: 'personal' })

    const req = { json: async () => ({ role: 'admin' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(409)
  })

  it('PATCH returns 403 when requester cannot manage', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce({ role: 'member' })

    const req = { json: async () => ({ role: 'admin' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(403)
  })

  it('PATCH returns 404 when member not found', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // requesterMembership
      .mockResolvedValueOnce(null) // member

    const req = { json: async () => ({ role: 'admin' }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(404)
  })

  it('PATCH returns 400 when trying to modify account owner', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // requesterMembership
      .mockResolvedValueOnce({ id: 'm1', userId: 'u-owner', role: 'owner', canEditContext: true }) // member

    const req = { json: async () => ({ role: 'admin', canEditContext: true }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(400)
  })

  it('PATCH returns 200 and updated member', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u-owner', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'u-owner', type: 'business' })
    dbMock.query.accountMembers.findFirst
      .mockResolvedValueOnce(null) // requesterMembership
      .mockResolvedValueOnce({ id: 'm1', userId: 'u2', role: 'member', canEditContext: false }) // member
      .mockResolvedValueOnce({
        id: 'm1',
        accountId: 'acc-1',
        userId: 'u2',
        role: 'admin',
        canEditContext: true,
        user: { id: 'u2', username: 'alice', displayName: 'Alice', pfpUrl: null },
      }) // updated

    const whereMock = vi.fn()
    const setMock = vi.fn(() => ({ where: whereMock }))
    dbMock.update.mockReturnValueOnce({ set: setMock })

    const req = { json: async () => ({ role: 'admin', canEditContext: true }) } as any
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1', memberId: 'm1' }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.member?.id).toBe('m1')
    expect(body.member?.role).toBe('admin')
    expect(whereMock).toHaveBeenCalledTimes(1)
  })
})
