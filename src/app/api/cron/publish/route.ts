import { NextRequest, NextResponse } from 'next/server'
import { publishDueCasts } from '@/lib/publisher'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * GET /api/cron/publish
 * Endpoint para publicar casts programados
 * Llamado por Netlify Scheduled Functions o manualmente
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // En producción, CRON_SECRET es obligatorio
  if (isProduction && !cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in production!')
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    )
  }

  // Verificar secret (siempre en producción, opcional en desarrollo)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // En producción sin header, rechazar
  if (isProduction && !authHeader) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const result = await publishDueCasts()
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Error publishing casts:', error)
    return NextResponse.json(
      { error: 'Failed to publish casts' },
      { status: 500 }
    )
  }
}

// También permitir POST para Netlify
export async function POST(request: NextRequest) {
  return GET(request)
}
