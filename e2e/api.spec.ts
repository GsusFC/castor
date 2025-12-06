import { test, expect } from '@playwright/test'

test.describe('API Endpoints', () => {
  test('GET /api/casts should require authentication', async ({ request }) => {
    const response = await request.get('/api/casts')
    
    // Sin autenticación, debería devolver 401
    expect(response.status()).toBe(401)
  })

  test('GET /api/accounts should require authentication', async ({ request }) => {
    const response = await request.get('/api/accounts')
    
    expect(response.status()).toBe(401)
  })

  test('POST /api/casts should require authentication', async ({ request }) => {
    const response = await request.post('/api/casts', {
      data: {
        content: 'Test cast',
        accountId: 'test',
        scheduledAt: new Date().toISOString(),
      },
    })
    
    expect(response.status()).toBe(401)
  })

  test('API should return JSON content type', async ({ request }) => {
    const response = await request.get('/api/casts')
    
    const contentType = response.headers()['content-type']
    expect(contentType).toContain('application/json')
  })
})
