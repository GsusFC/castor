import crypto from 'node:crypto'
import { env } from '@/lib/env'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

const getSecretSeed = (): string => {
  const seed = env.SESSION_SECRET
  if (!seed || seed.length < 16) {
    throw new Error('SESSION_SECRET is required to encrypt integration credentials')
  }
  return seed
}

const deriveKey = (seed: string): Buffer => crypto.createHash('sha256').update(seed).digest()

export const encryptSecret = (plaintext: string): string => {
  const key = deriveKey(getSecretSeed())
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export const decryptSecret = (encoded: string): string => {
  const parts = encoded.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format')
  }
  const [ivB64, tagB64, dataB64] = parts
  const key = deriveKey(getSecretSeed())
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}
