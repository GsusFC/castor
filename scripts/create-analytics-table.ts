import { config } from 'dotenv'
import { createClient } from '@libsql/client'

config()

const db = createClient({ 
  url: process.env.DATABASE_URL!, 
  authToken: process.env.DATABASE_AUTH_TOKEN 
})

async function run() {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS cast_analytics (
      id TEXT PRIMARY KEY,
      cast_hash TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      content TEXT,
      likes INTEGER NOT NULL DEFAULT 0,
      recasts INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      published_at INTEGER NOT NULL,
      last_updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`)
    console.log('✓ Table cast_analytics created')
    
    await db.execute('CREATE INDEX IF NOT EXISTS analytics_account_idx ON cast_analytics(account_id)')
    await db.execute('CREATE INDEX IF NOT EXISTS analytics_published_idx ON cast_analytics(published_at)')
    console.log('✓ Indexes created')
  } catch(e: any) { 
    console.error('Error:', e.message)
  }
}

run()
