import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

describe('middleware', () => {
  it('allows Netlify scheduled function paths without redirecting to /landing', async () => {
    const request = new NextRequest('https://castorapp.xyz/.netlify/functions/scheduled-publish')
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
