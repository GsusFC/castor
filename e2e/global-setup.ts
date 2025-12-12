import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'

const E2E_DB_FILE = path.resolve(process.cwd(), '.e2e.db')
const E2E_DB_URL = `file:${E2E_DB_FILE}`

function readMigrationFiles(): string[] {
  const migrationsDir = path.resolve(process.cwd(), 'drizzle')
  const entries = fs.readdirSync(migrationsDir)
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(migrationsDir, f))
}

export default async function globalSetup() {
  // Reset DB file for deterministic runs
  try {
    fs.rmSync(E2E_DB_FILE, { force: true })
  } catch {
    // ignore
  }

  const client = createClient({ url: E2E_DB_URL })

  // Apply migrations
  const migrationFiles = readMigrationFiles()
  for (const filePath of migrationFiles) {
    const sql = fs.readFileSync(filePath, 'utf8')
    // migrations may contain multiple statements
    await client.executeMultiple(sql)
  }

  const now = Date.now()

  // Seed users
  // NOTE: createdAt/updatedAt are not DB defaults; Drizzle uses $defaultFn in app layer.
  await client.execute({
    sql: `INSERT INTO users (id, fid, username, display_name, pfp_url, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    args: ['e2e-user-owner', 111111, 'owner', 'Owner', null, 'admin', now, now],
  })

  await client.execute({
    sql: `INSERT INTO users (id, fid, username, display_name, pfp_url, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    args: ['e2e-user-member', 222222, 'member', 'Member', null, 'member', now, now],
  })

  // Seed account
  await client.execute({
    sql: `INSERT INTO accounts (
            id, fid, username, display_name, pfp_url,
            signer_uuid, signer_status, type, is_premium,
            owner_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    args: [
      'e2e-account-1',
      333333,
      'e2eaccount',
      'E2E Account',
      null,
      'e2e-signer-uuid',
      'approved',
      'personal',
      0,
      'e2e-user-owner',
      now,
      now,
    ],
  })

  // Seed membership (member user, cannot edit context by default)
  await client.execute({
    sql: `INSERT INTO account_members (id, account_id, user_id, role, can_edit_context, invited_by_id, joined_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    args: ['e2e-member-1', 'e2e-account-1', 'e2e-user-member', 'member', 0, 'e2e-user-owner', now],
  })

  await client.close()

  // Make envs available to Playwright tests
  process.env.PLAYWRIGHT_E2E_DB_URL = E2E_DB_URL
  process.env.PLAYWRIGHT_E2E_BASE_URL = process.env.PLAYWRIGHT_E2E_BASE_URL || 'http://localhost:3002'
}
