import { NextRequest, NextResponse } from 'next/server'
import { db, castMedia } from '@/lib/db'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

const CF_WEBHOOK_SECRET = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

/**
 * Verifica la firma del webhook de Cloudflare
 * https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/#verify-webhook-authenticity
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  
  // Cloudflare usa HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  // Comparación segura contra timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

interface CloudflareStreamWebhookPayload {
  uid: string // Video ID
  readyToStream: boolean
  status: {
    state: 'queued' | 'inprogress' | 'ready' | 'error'
    // Campos de error según documentación
    errReasonCode?: string
    errReasonText?: string
  }
  meta?: Record<string, string>
  playback?: {
    hls?: string
    dash?: string
  }
  thumbnail?: string
  preview?: string
  created?: string
}

/**
 * POST /api/webhooks/cloudflare-stream
 * Recibe notificaciones de Cloudflare Stream cuando un video cambia de estado
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('webhook-signature')
    
    // Verificar firma si tenemos secret configurado
    if (CF_WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(payload, signature, CF_WEBHOOK_SECRET)) {
        console.error('[CF Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.warn('[CF Webhook] No webhook secret configured, skipping signature verification')
    }
    
    const data: CloudflareStreamWebhookPayload = JSON.parse(payload)
    
    console.log('[CF Webhook] Received:', {
      uid: data.uid,
      state: data.status?.state,
      readyToStream: data.readyToStream,
    })
    
    // Buscar el media por cloudflareId
    const media = await db.query.castMedia.findFirst({
      where: eq(castMedia.cloudflareId, data.uid),
    })
    
    if (!media) {
      console.warn('[CF Webhook] Media not found for video:', data.uid)
      // Devolver 200 para que Cloudflare no reintente
      return NextResponse.json({ received: true, found: false })
    }
    
    const state = data.status?.state
    
    if (state === 'ready' && data.readyToStream) {
      // Video listo - habilitar descargas y obtener URL MP4
      console.log('[CF Webhook] Video ready, enabling downloads:', data.uid)
      
      // Habilitar descargas MP4
      const enableDownloadsRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${data.uid}/downloads`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      )
      
      let mp4Url: string | null = null
      
      if (enableDownloadsRes.ok) {
        const downloadData = await enableDownloadsRes.json()
        mp4Url = downloadData.result?.default?.url
        console.log('[CF Webhook] Downloads enabled, MP4 URL:', mp4Url)
        
        // Si el MP4 no está listo inmediatamente, construir la URL
        if (!mp4Url && data.playback?.hls) {
          const customerSubdomain = data.playback.hls.match(/customer-([^.]+)/)?.[1]
          if (customerSubdomain) {
            mp4Url = `https://customer-${customerSubdomain}.cloudflarestream.com/${data.uid}/downloads/default.mp4`
          }
        }
      } else {
        console.warn('[CF Webhook] Could not enable downloads:', await enableDownloadsRes.text())
      }
      
      // Actualizar media en DB
      await db
        .update(castMedia)
        .set({
          videoStatus: 'ready',
          mp4Url: mp4Url || undefined,
          hlsUrl: data.playback?.hls || undefined,
          thumbnailUrl: data.thumbnail || undefined,
          // Actualizar URL principal al MP4 si está disponible
          url: mp4Url || data.playback?.hls || media.url,
        })
        .where(eq(castMedia.id, media.id))
      
      console.log('[CF Webhook] Media updated to ready:', media.id)
      
    } else if (state === 'error') {
      // Error en el procesamiento
      console.error('[CF Webhook] Video processing error:', {
        uid: data.uid,
        errorCode: data.status?.errReasonCode,
        errorText: data.status?.errReasonText,
      })
      
      await db
        .update(castMedia)
        .set({ videoStatus: 'error' })
        .where(eq(castMedia.id, media.id))
        
    } else if (state === 'inprogress') {
      // Actualizando estado a processing
      await db
        .update(castMedia)
        .set({ videoStatus: 'processing' })
        .where(eq(castMedia.id, media.id))
    }
    
    return NextResponse.json({ received: true, processed: true })
    
  } catch (error) {
    console.error('[CF Webhook] Error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * GET /api/webhooks/cloudflare-stream
 * Health check para verificar que el endpoint está activo
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    service: 'cloudflare-stream-webhook',
    timestamp: new Date().toISOString(),
  })
}
