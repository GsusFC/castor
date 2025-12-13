import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getSessionMock, dbMock, castorAIMock } = vi.hoisted(() => {
  const db: any = {
    query: {
      accounts: {
        findFirst: vi.fn(),
      },
      accountMembers: {
        findFirst: vi.fn(),
      },
    },
  }

  const castorAI: any = {
    getOrCreateProfile: vi.fn(),
    getAccountContext: vi.fn(),
    generateSuggestions: vi.fn(),
    analyzeAndSaveProfile: vi.fn(),
  }

  return {
    getSessionMock: vi.fn(),
    dbMock: db,
    castorAIMock: castorAI,
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

vi.mock('@/lib/ai/castor-ai', async (importActual) => {
  const actual = await importActual<any>()
  return {
    ...actual,
    castorAI: castorAIMock,
  }
})

import { POST } from './route'

describe('/api/ai/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null)

    const req = {
      json: async () => ({ mode: 'write', targetLanguage: 'en' }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(401)

    expect(dbMock.query.accounts.findFirst).not.toHaveBeenCalled()
    expect(dbMock.query.accountMembers.findFirst).not.toHaveBeenCalled()
    expect(castorAIMock.getAccountContext).not.toHaveBeenCalled()
    expect(castorAIMock.generateSuggestions).not.toHaveBeenCalled()
  })

  it('returns 403 when accountId is provided but not accessible', async () => {
    getSessionMock.mockResolvedValueOnce({
      userId: 'u1',
      fid: 1,
      role: 'member',
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://example.com/pfp.png',
    })

    castorAIMock.getOrCreateProfile.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      fid: 1,
      tone: 'casual',
      avgLength: 150,
      commonPhrases: [],
      topics: [],
      emojiUsage: 'light',
      languagePreference: 'en',
      sampleCasts: [],
      analyzedAt: new Date(),
    })

    dbMock.query.accounts.findFirst.mockResolvedValueOnce({ ownerId: 'other-user' })
    dbMock.query.accountMembers.findFirst.mockResolvedValueOnce(null)

    const req = {
      json: async () => ({ mode: 'write', accountId: 'acc-2', targetLanguage: 'en' }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(String(body.error)).toContain('Forbidden')

    expect(dbMock.query.accounts.findFirst).toHaveBeenCalledTimes(1)
    expect(dbMock.query.accountMembers.findFirst).toHaveBeenCalledTimes(1)

    expect(castorAIMock.getAccountContext).not.toHaveBeenCalled()
    expect(castorAIMock.generateSuggestions).not.toHaveBeenCalled()
  })

  it('returns 400 when targetLanguage is invalid', async () => {
    getSessionMock.mockResolvedValueOnce({
      userId: 'u1',
      fid: 1,
      role: 'member',
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://example.com/pfp.png',
    })

    const req = {
      json: async () => ({ mode: 'write', targetLanguage: 'xx' }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(String(body.error)).toContain('Unsupported targetLanguage')

    expect(castorAIMock.getOrCreateProfile).not.toHaveBeenCalled()
    expect(castorAIMock.generateSuggestions).not.toHaveBeenCalled()
  })

  it('returns 400 when translate mode omits targetLanguage', async () => {
    getSessionMock.mockResolvedValueOnce({
      userId: 'u1',
      fid: 1,
      role: 'member',
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://example.com/pfp.png',
    })

    const req = {
      json: async () => ({ mode: 'translate', draft: 'hola' }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(String(body.error)).toContain('targetLanguage is required')

    expect(castorAIMock.getOrCreateProfile).not.toHaveBeenCalled()
    expect(castorAIMock.generateSuggestions).not.toHaveBeenCalled()
  })

  it('returns suggestion objects on success', async () => {
    getSessionMock.mockResolvedValueOnce({
      userId: 'u1',
      fid: 1,
      role: 'member',
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://example.com/pfp.png',
    })

    castorAIMock.getOrCreateProfile.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      fid: 1,
      tone: 'casual',
      avgLength: 150,
      commonPhrases: [],
      topics: [],
      emojiUsage: 'light',
      languagePreference: 'en',
      sampleCasts: [],
      analyzedAt: new Date(),
    })

    castorAIMock.generateSuggestions.mockResolvedValueOnce(['hola', 'adios', 'buenas'])

    const req = {
      json: async () => ({
        mode: 'write',
        targetTone: 'casual',
        targetLanguage: 'es',
      }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.suggestions)).toBe(true)
    expect(body.suggestions).toHaveLength(3)

    const s0 = body.suggestions[0]
    expect(typeof s0.id).toBe('string')
    expect(s0.id.length).toBeGreaterThan(0)
    expect(s0.text).toBe('hola')
    expect(s0.length).toBe(4)
    expect(s0.mode).toBe('write')
    expect(s0.targetTone).toBe('casual')
    expect(s0.targetLanguage).toBe('es')

    expect(dbMock.query.accounts.findFirst).not.toHaveBeenCalled()
    expect(dbMock.query.accountMembers.findFirst).not.toHaveBeenCalled()
  })

  it('returns 502 with code/message when AI response is invalid', async () => {
    getSessionMock.mockResolvedValueOnce({
      userId: 'u1',
      fid: 1,
      role: 'member',
      username: 'alice',
      displayName: 'Alice',
      pfpUrl: 'https://example.com/pfp.png',
    })

    castorAIMock.getOrCreateProfile.mockResolvedValueOnce({
      id: 'p1',
      userId: 'u1',
      fid: 1,
      tone: 'casual',
      avgLength: 150,
      commonPhrases: [],
      topics: [],
      emojiUsage: 'light',
      languagePreference: 'en',
      sampleCasts: [],
      analyzedAt: new Date(),
    })

    castorAIMock.generateSuggestions.mockRejectedValueOnce(
      new Error('Invalid AI response: expected suggestions array')
    )

    const req = {
      json: async () => ({
        mode: 'write',
        targetLanguage: 'en',
      }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(502)

    const body = await res.json()
    expect(body.code).toBe('AI_BAD_RESPONSE')
    expect(String(body.message)).toContain('respuesta inválida')
    expect(Array.isArray(body.suggestions)).toBe(true)
    expect(body.suggestions).toHaveLength(0)
  })
})
