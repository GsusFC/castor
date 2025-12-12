import { test, expect, request as pwRequest } from '@playwright/test'
import { createSessionCookieValue, type E2EAuthUser } from './utils/auth'

const BASE_URL = process.env.PLAYWRIGHT_E2E_BASE_URL || 'http://localhost:3002'
const SESSION_SECRET = process.env.SESSION_SECRET || 'castor-dev-secret-key-min-32-chars!'

const ownerUser: E2EAuthUser = {
  userId: 'e2e-user-owner',
  fid: 111111,
  username: 'owner',
  displayName: 'Owner',
  pfpUrl: '',
  role: 'admin',
}

const memberUser: E2EAuthUser = {
  userId: 'e2e-user-member',
  fid: 222222,
  username: 'member',
  displayName: 'Member',
  pfpUrl: '',
  role: 'member',
}

const ACCOUNT_ID = 'e2e-account-1'

test.describe('Multi-tenant permissions', () => {
  test('member can see shared account via accountMembers', async ({ request }) => {
    const cookie = await createSessionCookieValue(memberUser, SESSION_SECRET)

    const api = await pwRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        cookie: `castor_session=${cookie}`,
      },
    })

    const res = await api.get('/api/accounts')
    expect(res.status()).toBe(200)

    const body = await res.json()
    const ids = (body.accounts || []).map((a: any) => a.id)
    expect(ids).toContain(ACCOUNT_ID)

    await api.dispose()
  })

  test('member cannot edit context when canEditContext=false, then owner enables and member can edit', async ({ request }) => {
    const memberCookie = await createSessionCookieValue(memberUser, SESSION_SECRET)
    const ownerCookie = await createSessionCookieValue(ownerUser, SESSION_SECRET)

    const memberApi = await pwRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        cookie: `castor_session=${memberCookie}`,
      },
    })

    const ownerApi = await pwRequest.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        cookie: `castor_session=${ownerCookie}`,
      },
    })

    // Ensure deterministic state across projects (chromium/mobile share the same DB)
    const resetRes = await ownerApi.patch(`/api/accounts/${ACCOUNT_ID}/members/e2e-member-1`, {
      data: { canEditContext: false },
    })
    expect(resetRes.status()).toBe(200)

    // Member cannot edit initially
    const forbidden = await memberApi.put(`/api/accounts/${ACCOUNT_ID}/context`, {
      data: {
        brandVoice: 'x',
        bio: 'x',
        expertise: [],
        alwaysDo: [],
        neverDo: [],
        hashtags: [],
        defaultTone: 'casual',
        defaultLanguage: 'en',
      },
    })
    expect(forbidden.status()).toBe(403)

    // Owner enables canEditContext for the seeded member row
    const patchRes = await ownerApi.patch(`/api/accounts/${ACCOUNT_ID}/members/e2e-member-1`, {
      data: { canEditContext: true },
    })
    expect(patchRes.status()).toBe(200)

    // Member can edit now
    const ok = await memberApi.put(`/api/accounts/${ACCOUNT_ID}/context`, {
      data: {
        brandVoice: 'hello',
        bio: 'bio',
        expertise: [],
        alwaysDo: [],
        neverDo: [],
        hashtags: [],
        defaultTone: 'casual',
        defaultLanguage: 'en',
      },
    })
    expect(ok.status()).toBe(200)

    await memberApi.dispose()
    await ownerApi.dispose()
  })
})
