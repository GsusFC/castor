import { eq } from 'drizzle-orm'
import { db, typefullyConnections } from '@/lib/db'
import { decryptSecret } from '@/lib/crypto/secrets'
import { TypefullyClient } from './typefully'

export async function getTypefullyConnectionForUser(userId: string) {
  return db.query.typefullyConnections.findFirst({
    where: eq(typefullyConnections.userId, userId),
  })
}

export async function getTypefullyClientForUser(userId: string): Promise<TypefullyClient | null> {
  const connection = await getTypefullyConnectionForUser(userId)
  if (!connection) return null
  const apiKey = decryptSecret(connection.encryptedApiKey)
  return new TypefullyClient({ apiKey })
}
