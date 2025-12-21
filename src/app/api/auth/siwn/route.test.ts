import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createSessionMock, getSignerStatusMock, getUserByFidMock, dbMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      accounts: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  }

  return {
    createSessionMock: vi.fn(async () => undefined),
    getSignerStatusMock: vi.fn(),
    getUserByFidMock: vi.fn(),
    dbMock: db,
  }
})

vi.mock('@/lib/auth', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    createSession: createSessionMock,
  }
})

vi.mock('@/lib/farcaster', () => ({
  getSignerStatus: getSignerStatusMock,
  getUserByFid: getUserByFidMock,
}))

vi.mock('@/lib/db', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    db: dbMock,
  }
})

import { POST } from './route'

const assertResponse = <T extends Response | undefined>(res: T): Response => {
  if (!res) throw new Error('Expected route handler to return a Response')
  return res
}

describe('/api/auth/siwn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when signerUuid is missing', async () => {
    const req = { json: async () => ({}) } as any
    const res = assertResponse(await POST(req))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'signerUuid' }),
      ])
    )
  })

  it('returns 403 when signer is not approved', async () => {
    getSignerStatusMock.mockResolvedValueOnce({
      success: true,
      signer: { status: 'pending', fid: 123 },
    })

    const req = { json: async () => ({ signerUuid: 'signer-1', fid: 123 }) } as any
    const res = assertResponse(await POST(req))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('FORBIDDEN')
  })

  it('returns 403 when fid mismatches signer fid', async () => {
    getSignerStatusMock.mockResolvedValueOnce({
      success: true,
      signer: { status: 'approved', fid: 123 },
    })

    const req = { json: async () => ({ signerUuid: 'signer-1', fid: 999 }) } as any
    const res = assertResponse(await POST(req))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('FORBIDDEN')
  })

  it('returns 200 and creates session on success (new user + new account)', async () => {
    getSignerStatusMock.mockResolvedValueOnce({
      success: true,
      signer: { status: 'approved', fid: 123 },
    })

    getUserByFidMock.mockResolvedValueOnce({
      success: true,
      user: {
        fid: 123,
        username: 'alice',
        displayName: null,
        pfpUrl: null,
        isPremium: false,
      },
    })

    dbMock.query.users.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'u1', fid: 123, username: 'alice', role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce(null)

    const req = { json: async () => ({ signerUuid: 'signer-1', fid: 123 }) } as any
    const res = assertResponse(await POST(req))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.user.fid).toBe(123)
    expect(body.data.signer.signerUuid).toBe('signer-1')

    expect(createSessionMock).toHaveBeenCalledTimes(1)
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        fid: 123,
        username: 'alice',
        role: 'member',
      })
    )
  })
})
