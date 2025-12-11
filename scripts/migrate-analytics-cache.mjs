import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

async function migrate() {
  console.log('Creating analytics_insights_cache table...')
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS analytics_insights_cache (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      insights TEXT NOT NULL,
      stats TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `)
  
  await client.execute(`
    CREATE INDEX IF NOT EXISTS analytics_insights_cache_account_idx 
    ON analytics_insights_cache(account_id)
  `)
  
  console.log('✅ Migration complete!')
}

migrate().catch(console.error)
