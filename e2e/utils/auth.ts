import crypto from 'node:crypto'

export interface E2EAuthUser {
  userId: string
  fid: number
  username: string
  displayName: string
  pfpUrl: string
  role: 'admin' | 'member'
}

const base64UrlEncode = (input: Buffer | string): string => {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export const createSessionCookieValue = async (user: E2EAuthUser, secret: string): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const expiresAt = Math.floor(expiresAtDate.getTime() / 1000)

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  // Match app payload shape: { user, expiresAt: ISO }
  const payload = {
    user,
    expiresAt: expiresAtDate.toISOString(),
    iat: issuedAt,
    exp: expiresAt,
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const data = `${headerB64}.${payloadB64}`

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest()

  const sigB64 = base64UrlEncode(signature)
  return `${data}.${sigB64}`
}
