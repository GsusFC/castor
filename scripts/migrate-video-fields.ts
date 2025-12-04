/**
 * Script para añadir campos de video a cast_media
 * Ejecutar con: npx tsx scripts/migrate-video-fields.ts
 */

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Cargar .env manualmente
const envPath = resolve(process.cwd(), '.env')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const [, key, value] = match
    process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
  }
}

console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 30) + '...')

const client = createClient({
  url: process.env.DATABASE_URL ?? 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

async function migrate() {
  console.log('Añadiendo campos de video a cast_media...')
  
  const statements = [
    "ALTER TABLE `cast_media` ADD `cloudflare_id` text",
    "ALTER TABLE `cast_media` ADD `video_status` text",
    "ALTER TABLE `cast_media` ADD `mp4_url` text",
    "ALTER TABLE `cast_media` ADD `hls_url` text",
    "ALTER TABLE `cast_media` ADD `thumbnail_url` text",
  ]
  
  for (const sql of statements) {
    try {
      await client.execute(sql)
      console.log('✓', sql.substring(0, 60) + '...')
    } catch (error) {
      // Ignorar si la columna ya existe
      if (error instanceof Error && error.message.includes('duplicate column')) {
        console.log('⊘ Columna ya existe:', sql.substring(0, 60) + '...')
      } else {
        throw error
      }
    }
  }
  
  // Crear índice
  try {
    await client.execute("CREATE INDEX `media_cloudflare_idx` ON `cast_media` (`cloudflare_id`)")
    console.log('✓ Índice media_cloudflare_idx creado')
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('⊘ Índice ya existe')
    } else {
      throw error
    }
  }
  
  console.log('\n✅ Migración completada')
}

migrate().catch(console.error)
