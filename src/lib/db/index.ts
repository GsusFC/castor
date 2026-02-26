import { drizzle } from 'drizzle-orm/libsql/http'
import { createClient } from '@libsql/client/http'
import * as schema from './schema'
import { env } from '@/lib/env'

const client = createClient({
  // Keep a HTTP-compatible fallback so module initialization does not crash in test envs.
  url: env.DATABASE_URL ?? 'http://127.0.0.1:8080',
  authToken: env.DATABASE_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })

export * from './schema'
