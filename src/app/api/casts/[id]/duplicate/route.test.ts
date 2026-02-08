import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionMock, canAccessMock, dbMock, generateIdMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      scheduledCasts: {
        findFirst: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  }

  return {
    getSessionMock: vi.fn(),
    canAccessMock: vi.fn(),
    dbMock: db,
    generateIdMock: vi.fn(),
  }
})

vi.mock('@/lib/auth', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    getSession: getSessionMock,
    canAccess: canAccessMock,
  }
})

vi.mock('@/lib/db', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    db: dbMock,
  }
})

vi.mock('@/lib/utils', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    generateId: generateIdMock,
  }
})

import { POST } from './route'

describe('/api/casts/[id]/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const res = await POST({} as any, { params: Promise.resolve({ id: 'cast-1' }) })
    expect(res.status).toBe(401)
  })

  it('duplicates cast as draft and copies media', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', role: 'member' })
    canAccessMock.mockReturnValueOnce(true)
    generateIdMock.mockReturnValueOnce('new-cast-id').mockReturnValueOnce('media-copy-id')

    dbMock.query.scheduledCasts.findFirst.mockResolvedValueOnce({
      id: 'cast-1',
      accountId: 'acc-1',
      content: 'hello world',
      channelId: 'dev',
      parentHash: null,
      media: [
        {
          id: 'media-1',
          url: 'https://img.example/a.png',
          type: 'image',
          order: 0,
          cloudflareId: null,
          livepeerAssetId: null,
          livepeerPlaybackId: null,
          videoStatus: null,
          mp4Url: null,
          hlsUrl: null,
          thumbnailUrl: null,
          width: 100,
          height: 100,
        },
      ],
      account: {
        id: 'acc-1',
        ownerId: 'owner-1',
      },
    })

    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce({
      id: 'member-1',
      accountId: 'acc-1',
      userId: 'u1',
    })

    const valuesMock = vi.fn()
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
    dbMock.transaction.mockImplementationOnce(async (callback: any) => {
      await callback({
        insert: insertMock,
      })
    })

    const res = await POST({} as any, { params: Promise.resolve({ id: 'cast-1' }) })
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.castId).toBe('new-cast-id')
    expect(body.data.status).toBe('draft')

    expect(dbMock.transaction).toHaveBeenCalledOnce()
    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(valuesMock).toHaveBeenCalled()
  })
})
