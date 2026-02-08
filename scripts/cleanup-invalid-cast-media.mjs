import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(projectRoot, '.env') })
dotenv.config({ path: path.join(projectRoot, '.env.local') })

const DATABASE_URL = process.env.DATABASE_URL || 'file:local.db'
const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG_INDEX = process.argv.findIndex((arg) => arg === '--limit')
const LIMIT = LIMIT_ARG_INDEX > -1 ? Number(process.argv[LIMIT_ARG_INDEX + 1]) || 25 : 25

const client = createClient({
  url: DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN,
})

async function getCastMediaColumns() {
  const rs = await client.execute("PRAGMA table_info('cast_media')")
  return new Set((rs.rows || []).map((r) => String(r.name)))
}

function buildWhere(columns) {
  const hasLivepeerAssetId = columns.has('livepeer_asset_id')
  const hasCloudflareId = columns.has('cloudflare_id')

  const clauses = [
    "m.type = 'image'",
    "LOWER(m.url) LIKE 'http%'",
    "LOWER(m.url) NOT LIKE '%imagedelivery.net%'",
    "LOWER(m.url) NOT LIKE '%cloudflare%'",
    "LOWER(m.url) NOT LIKE '%livepeer%'",
    "LOWER(m.url) NOT LIKE '%lp-playback%'",
    "LOWER(m.url) NOT GLOB '*.jpg*'",
    "LOWER(m.url) NOT GLOB '*.jpeg*'",
    "LOWER(m.url) NOT GLOB '*.png*'",
    "LOWER(m.url) NOT GLOB '*.gif*'",
    "LOWER(m.url) NOT GLOB '*.webp*'",
    "LOWER(m.url) NOT GLOB '*.svg*'",
    "LOWER(m.url) NOT GLOB '*.avif*'",
    "LOWER(m.url) NOT GLOB '*.mp4*'",
    "LOWER(m.url) NOT GLOB '*.mov*'",
    "LOWER(m.url) NOT GLOB '*.webm*'",
    "LOWER(m.url) NOT GLOB '*.m3u8*'",
  ]

  if (hasCloudflareId) clauses.push("COALESCE(m.cloudflare_id, '') = ''")
  if (hasLivepeerAssetId) clauses.push("COALESCE(m.livepeer_asset_id, '') = ''")

  return clauses.join('\n  AND ')
}

async function main() {
  console.log('--- cleanup-invalid-cast-media ---')
  console.log(`DB: ${DATABASE_URL}`)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

  const columns = await getCastMediaColumns()
  const where = buildWhere(columns)

  const countRs = await client.execute(`
    SELECT COUNT(*) AS count
    FROM cast_media m
    WHERE ${where}
  `)
  const count = Number(countRs.rows?.[0]?.count || 0)
  console.log(`Candidates: ${count}`)

  const sampleRs = await client.execute({
    sql: `
      SELECT
        m.id,
        m.cast_id,
        m.url,
        c.status AS cast_status,
        c.account_id,
        c.created_at
      FROM cast_media m
      JOIN scheduled_casts c ON c.id = m.cast_id
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT ?
    `,
    args: [LIMIT],
  })

  if ((sampleRs.rows?.length || 0) > 0) {
    console.log(`\nSample (${sampleRs.rows.length} rows):`)
    for (const row of sampleRs.rows) {
      console.log(`- media=${row.id} cast=${row.cast_id} status=${row.cast_status} url=${row.url}`)
    }
  }

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to delete these rows.')
    return
  }

  const deleteRs = await client.execute(`
    DELETE FROM cast_media
    WHERE id IN (
      SELECT m.id
      FROM cast_media m
      WHERE ${where}
    )
    RETURNING id
  `)

  const deleted = deleteRs.rows?.length || 0
  console.log(`\nDeleted rows: ${deleted}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error('cleanup failed:', err)
  process.exit(1)
})
