/**
 * Script para configurar el webhook de Cloudflare Stream
 * Ejecutar con: npx tsx scripts/setup-cloudflare-webhook.ts
 * 
 * Requiere:
 * - CLOUDFLARE_ACCOUNT_ID en .env
 * - CLOUDFLARE_IMAGES_API_KEY en .env (con permisos de Stream)
 * - NEXT_PUBLIC_APP_URL en .env (tu dominio público)
 */

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

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_API_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL

async function setupWebhook() {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    console.error('❌ Falta CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_IMAGES_API_KEY en .env')
    process.exit(1)
  }

  if (!APP_URL) {
    console.error('❌ Falta NEXT_PUBLIC_APP_URL en .env')
    process.exit(1)
  }

  const webhookUrl = `${APP_URL}/api/webhooks/cloudflare-stream`
  
  console.log('🔧 Configurando webhook de Cloudflare Stream...')
  console.log(`   Account ID: ${CF_ACCOUNT_ID}`)
  console.log(`   Webhook URL: ${webhookUrl}`)
  console.log('')

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/webhook`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationUrl: webhookUrl,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('❌ Error configurando webhook:')
      console.error(JSON.stringify(data.errors || data, null, 2))
      process.exit(1)
    }

    console.log('✅ Webhook configurado exitosamente!')
    console.log('')
    console.log('📋 Detalles:')
    console.log(`   URL: ${data.result?.notificationUrl}`)
    console.log(`   Modified: ${data.result?.modified}`)
    
    // El secret se devuelve en la respuesta
    if (data.result?.secret) {
      console.log('')
      console.log('🔐 SECRET (añade esto a tu .env):')
      console.log(`   CLOUDFLARE_STREAM_WEBHOOK_SECRET=${data.result.secret}`)
      console.log('')
      console.log('⚠️  IMPORTANTE: Guarda este secret, no se mostrará de nuevo!')
    }

    console.log('')
    console.log('📨 Eventos que recibirás:')
    console.log('   - ready: Video procesado exitosamente')
    console.log('   - error: Video falló al procesarse')

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Verificar webhook actual
async function checkWebhook() {
  console.log('🔍 Verificando webhook actual...')
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/webhook`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
      },
    }
  )

  const data = await response.json()
  
  if (data.success && data.result?.notificationUrl) {
    console.log(`   Webhook actual: ${data.result.notificationUrl}`)
    console.log(`   Modificado: ${data.result.modified}`)
    return true
  } else {
    console.log('   No hay webhook configurado')
    return false
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Cloudflare Stream Webhook Setup')
  console.log('═══════════════════════════════════════════')
  console.log('')

  await checkWebhook()
  console.log('')
  
  await setupWebhook()
}

main().catch(console.error)
