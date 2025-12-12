import { describe, expect, it } from 'vitest'
import { assertUrlIsSafe } from './ssrf'

describe('assertUrlIsSafe', () => {
  it('blocks localhost hostnames', async () => {
    await expect(assertUrlIsSafe(new URL('https://localhost/'))).rejects.toThrow()
    await expect(assertUrlIsSafe(new URL('https://foo.localhost/'))).rejects.toThrow()
  })

  it('blocks private IP literals', async () => {
    await expect(assertUrlIsSafe(new URL('http://127.0.0.1/'))).rejects.toThrow()
    await expect(assertUrlIsSafe(new URL('http://10.0.0.1/'))).rejects.toThrow()
    await expect(assertUrlIsSafe(new URL('http://192.168.0.1/'))).rejects.toThrow()
  })

  it('blocks userinfo in URL', async () => {
    await expect(assertUrlIsSafe(new URL('https://user:pass@example.com/'))).rejects.toThrow()
  })

  it('allows a public hostname when DNS resolves to public IP', async () => {
    await expect(
      assertUrlIsSafe(new URL('https://example.com/'), {
        lookup: async () => [{ address: '93.184.216.34' }],
      })
    ).resolves.toBeUndefined()
  })

  it('blocks a public hostname that resolves to private IP', async () => {
    await expect(
      assertUrlIsSafe(new URL('https://evil.example/'), {
        lookup: async () => [{ address: '10.0.0.10' }],
      })
    ).rejects.toThrow()
  })
})
