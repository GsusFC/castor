import { POST } from './route'
import { describe, expect, it } from 'vitest'

describe('/api/auth/siwn (deprecated)', () => {
  it('returns 410', async () => {
    const res = await POST()
    expect(res.status).toBe(410)

    const body = await res.json()
    expect(body).toEqual(
      expect.objectContaining({
        code: 'DEPRECATED',
      })
    )
  })
})
