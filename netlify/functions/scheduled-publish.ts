import type { Config, Context } from '@netlify/functions'

/**
 * Netlify Scheduled Function
 * Se ejecuta cada minuto para publicar casts programados
 */
export default async (req: Request, context: Context) => {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || ''

  try {
    const response = await fetch(`${siteUrl}/api/cron/publish`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    console.log('[Netlify Cron] Publish result:', data)

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Netlify Cron] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to trigger publish' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Ejecutar cada minuto
export const config: Config = {
  schedule: '* * * * *', // Cada minuto
}
