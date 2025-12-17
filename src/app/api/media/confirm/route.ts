import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY
// Dominio de Cloudflare Stream personalizado (validado por Farcaster)
const CF_STREAM_DOMAIN = process.env.CLOUDFLARE_STREAM_DOMAIN || 'video.castorapp.xyz'

/**
 * POST /api/media/confirm
 * Confirma que un video se subió y habilita descargas MP4
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      return ApiErrors.operationFailed('Media not configured')
    }

    const body = await request.json()
    const { cloudflareId, type } = body

    if (!cloudflareId || !type) {
      return ApiErrors.validationFailed([
        { field: 'cloudflareId', message: 'cloudflareId and type are required' }
      ])
    }

    if (type === 'image') {
      // Para imágenes, obtener la URL pública
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1/${cloudflareId}`,
        {
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[Confirm] Image not found:', cloudflareId)
        return ApiErrors.notFound('Image')
      }

      const imageUrl = data.result.variants?.find((v: string) => v.includes('/public')) 
        || data.result.variants?.[0]

      console.log('[Confirm] Image confirmed:', cloudflareId)

      return success({
        url: imageUrl,
        type: 'image',
        id: cloudflareId,
      })

    } else if (type === 'video') {
      // Para videos, verificar estado y habilitar descargas
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${cloudflareId}`,
        {
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[Confirm] Video not found:', cloudflareId)
        return ApiErrors.notFound('Video')
      }

      const video = data.result
      const isReady = video.readyToStream
      
      // Obtener dimensiones del video
      const width = video.input?.width || null
      const height = video.input?.height || null

      // Intentar habilitar descargas si el video está listo
      let mp4Url: string | null = null
      if (isReady) {
        try {
          const downloadRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${cloudflareId}/downloads`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            }
          )

          if (downloadRes.ok) {
            const downloadData = await downloadRes.json()
            mp4Url = downloadData.result?.default?.url
            console.log('[Confirm] Downloads enabled:', mp4Url)
          }
        } catch (err) {
          console.warn('[Confirm] Could not enable downloads:', err)
        }
      }

      // Construir URLs del video
      // Cloudflare genera la URL HLS inmediatamente, aunque el video no esté procesado
      const hlsUrl = video.playback?.hls
      const watchUrl = `https://watch.cloudflarestream.com/${cloudflareId}`
      
      // Construir URLs con dominio personalizado (requerido por Farcaster)
      // Formato Farcaster: video URL y thumbnail deben compartir base path
      // HLS: https://video.castorapp.xyz/{id}/manifest/video.m3u8
      // Thumbnail: https://video.castorapp.xyz/{id}/thumbnails/thumbnail.jpg
      const baseUrl = `https://${CF_STREAM_DOMAIN}/${cloudflareId}`
      const finalHlsUrl = `${baseUrl}/manifest/video.m3u8`
      
      // Thumbnail URL - Cloudflare usa /thumbnails/thumbnail.jpg
      // Farcaster espera que al reemplazar .m3u8 path funcione
      const thumbnailUrl = `${baseUrl}/thumbnails/thumbnail.jpg`

      console.log('[Confirm] Video confirmed:', {
        cloudflareId,
        isReady,
        hlsUrl: finalHlsUrl,
        mp4Url,
        width,
        height,
      })

      // Farcaster requiere .m3u8 (HLS), NO mp4
      // La URL debe terminar en .m3u8 y soportar /thumbnail.jpg
      // Formato: https://video.castorapp.xyz/{id}/manifest/video.m3u8
      // Thumbnail: https://video.castorapp.xyz/{id}/thumbnails/thumbnail.jpg
      
      return success({
        url: finalHlsUrl, // Siempre usar HLS para Farcaster
        type: 'video',
        id: cloudflareId,
        cloudflareId,
        videoStatus: isReady ? 'ready' : 'pending',
        hlsUrl: finalHlsUrl,
        mp4Url: mp4Url || `${baseUrl}/downloads/default.mp4`,
        watchUrl,
        thumbnailUrl,
        width,
        height,
      })
    }

    return ApiErrors.validationFailed([{ field: 'type', message: 'Invalid type' }])

  } catch (error) {
    console.error('[Confirm] Error:', error)
    return ApiErrors.operationFailed('Failed to confirm upload')
  }
}
