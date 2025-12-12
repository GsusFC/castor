import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@libsql/client'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const client = createClient({
  url: DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

const sha256 = (input) => crypto.createHash('sha256').update(input).digest('hex')

const ensureMigrationsTable = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )
  `)
}

const getMigrationsCount = async () => {
  const res = await client.execute('SELECT COUNT(*) AS count FROM "__drizzle_migrations"')
  const row = res.rows?.[0]
  const count = typeof row?.count === 'number' ? row.count : Number(row?.count ?? 0)
  return Number.isFinite(count) ? count : 0
}

const getAppliedHashes = async () => {
  const res = await client.execute('SELECT hash FROM "__drizzle_migrations"')
  const hashes = new Set()
  for (const row of res.rows ?? []) {
    if (row?.hash) hashes.add(String(row.hash))
  }
  return hashes
}

const hasTable = async (tableName) => {
  const res = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    args: [tableName],
  })
  return (res.rows?.length ?? 0) > 0
}

const readJournal = () => {
  const journalPath = path.resolve(process.cwd(), 'drizzle', 'meta', '_journal.json')
  const raw = fs.readFileSync(journalPath, 'utf8')
  const parsed = JSON.parse(raw)
  return parsed.entries ?? []
}

const readMigrationSql = (tag) => {
  const sqlPath = path.resolve(process.cwd(), 'drizzle', `${tag}.sql`)
  return fs.readFileSync(sqlPath, 'utf8')
}

const apply0009Idempotent = async () => {
  // analytics_insights_cache (might already exist if it was created manually)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS analytics_insights_cache (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      insights TEXT NOT NULL,
      stats TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE cascade
    )
  `)

  await client.execute(
    'CREATE INDEX IF NOT EXISTS analytics_insights_cache_account_idx ON analytics_insights_cache(account_id)'
  )

  // Drop is_shared only if it exists
  const cols = await client.execute('PRAGMA table_info(accounts)')
  const hasIsShared = (cols.rows ?? []).some((r) => r?.name === 'is_shared')
  if (hasIsShared) {
    await client.execute('ALTER TABLE accounts DROP COLUMN is_shared')
  }
}

const shouldBaselineTag = (tag) => {
  const baselineMode = process.env.DRIZZLE_BASELINE === '1'
  if (!baselineMode) return false

  const upToTag = process.env.DRIZZLE_BASELINE_UP_TO_TAG
  if (!upToTag) return true

  // Tags are prefixed with 4-digit incremental numbers, so lexicographic compare works.
  return tag <= upToTag
}

const main = async () => {
  await ensureMigrationsTable()

  const baselineMode = process.env.DRIZZLE_BASELINE === '1'
  const migrationsCount = await getMigrationsCount()
  const alreadyHasAccounts = await hasTable('accounts')

  if (!baselineMode && migrationsCount === 0 && alreadyHasAccounts) {
    throw new Error(
      'DB has tables but __drizzle_migrations is empty. Re-run with DRIZZLE_BASELINE=1 to record migrations without executing SQL.'
    )
  }

  const appliedHashes = await getAppliedHashes()
  const journalEntries = readJournal()

  for (const entry of journalEntries) {
    const tag = entry.tag
    const when = entry.when

    const sql = readMigrationSql(tag)
    const hash = sha256(sql)

    if (appliedHashes.has(hash)) continue

    const baselineThisTag = shouldBaselineTag(tag)

    if (!baselineThisTag) {
      if (tag === '0009_broken_firebird') {
        await apply0009Idempotent()
      } else {
        await client.executeMultiple(sql)
      }
    }

    await client.execute({
      sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
      args: [hash, when],
    })

    appliedHashes.add(hash)
  }

  console.log(`✅ Done. baseline=${baselineMode}`)
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.close()
  })
