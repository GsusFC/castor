import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { getSessionMock, dbMock, generateContentMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      accounts: {
        findFirst: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
      },
      userStyleProfiles: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(),
      })),
    })),
  }

  const generateContent = vi.fn(async (prompt: string) => {
    if (prompt.includes('Responde SOLO con JSON válido') && prompt.includes('"brandVoice"')) {
      return {
        response: {
          text: () =>
            JSON.stringify({
              brandVoice: 'Voice',
              tone: 'casual',
              topics: ['t1'],
              emojiUsage: 'light',
              languagePreference: 'en',
              avgLength: 120,
              alwaysDo: ['a'],
              neverDo: ['n'],
              hashtags: ['#h'],
            }),
        },
      }
    }

    return {
      response: {
        text: () => 'analysis',
      },
    }
  })

  return {
    getSessionMock: vi.fn(),
    dbMock: db,
    generateContentMock: generateContent,
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

vi.mock('@google/generative-ai', () => {
  class GoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: generateContentMock,
      }
    }
  }

  return { GoogleGenerativeAI }
})

import { POST } from './route'

describe('/api/accounts/[id]/style-profile', () => {
  const originalFetch = global.fetch
  const originalSetTimeout = global.setTimeout

  beforeEach(() => {
    vi.clearAllMocks()

    // Evitar esperas en tests (hay un await new Promise(resolve => setTimeout(resolve, 500)))
    vi.stubGlobal('setTimeout', ((fn: any) => {
      fn()
      return 0 as any
    }) as any)

    // Mock de Neynar casts fetch
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        casts: [{ text: 'this is a cast text long enough' }, { text: 'another cast text long enough' }, { text: 'third cast text long enough' }, { text: 'fourth cast text long enough' }, { text: 'fifth cast text long enough' }],
        next: null,
      }),
    })) as any)
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.setTimeout = originalSetTimeout
  })

  it('updates existing profile (no UNIQUE violation on user_id)', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'member-1', fid: 1, role: 'member' })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({
      id: 'acc-1',
      fid: 999,
      ownerId: 'owner-1',
    })

    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce({ id: 'm1' })

    dbMock.query.userStyleProfiles.findFirst.mockResolvedValueOnce({
      id: 'profile-1',
      userId: 'owner-1',
      fid: 999,
      tone: 'casual',
      avgLength: 150,
      commonPhrases: '[]',
      topics: '[]',
      emojiUsage: 'light',
      languagePreference: 'en',
      sampleCasts: '[]',
      analyzedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await POST({} as any, { params: Promise.resolve({ id: 'acc-1' }) })
    expect(res.status).toBe(200)

    expect(dbMock.update).toHaveBeenCalledTimes(1)
    expect(dbMock.insert).not.toHaveBeenCalled()

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.profile).toBeDefined()
  })
})
