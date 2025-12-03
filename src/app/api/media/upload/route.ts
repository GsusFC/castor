import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiLogger, createTimer } from '@/lib/logger'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

export async function POST(request: NextRequest) {
  const timer = createTimer()

  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Verificar configuración de Cloudflare
    if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      apiLogger.error({}, 'Cloudflare Images not configured')
      return ApiErrors.operationFailed('Media upload not configured')
    }

    // Rate limiting estricto para uploads (operación costosa)
    const rateLimit = await checkRateLimit(`upload:${session.userId}`, 'expensive')
    if (!rateLimit.success) {
      apiLogger.warn({ userId: session.userId }, 'Rate limit exceeded for upload')
      return ApiErrors.rateLimited()
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return ApiErrors.validationFailed([{ field: 'file', message: 'No file provided' }])
    }

    // Validar tipo de archivo
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm']
    const isImage = validImageTypes.includes(file.type)
    const isVideo = validVideoTypes.includes(file.type)

    if (!isImage && !isVideo) {
      return ApiErrors.validationFailed([{ 
        field: 'file', 
        message: 'Unsupported file type. Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.' 
      }])
    }

    // Validar tamaño
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return ApiErrors.validationFailed([{ 
        field: 'file', 
        message: `File too large. Maximum ${isVideo ? '100MB' : '10MB'}.` 
      }])
    }

    // Subir a Cloudflare Images o Stream
    if (isImage) {
      // Cloudflare Images API
      const cfFormData = new FormData()
      cfFormData.append('file', file)
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
          },
          body: cfFormData,
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        apiLogger.error({ 
          status: response.status, 
          errors: data.errors,
          userId: session.userId,
        }, 'Cloudflare Images upload failed')
        return ApiErrors.externalError('Cloudflare Images')
      }

      // Cloudflare Images devuelve variants, usamos la "public"
      const imageUrl = data.result.variants?.find((v: string) => v.includes('/public')) 
        || data.result.variants?.[0]

      console.log('[Upload] Image uploaded:', imageUrl)

      return success({
        url: imageUrl,
        type: 'image',
        id: data.result.id,
      })

    } else {
      // Cloudflare Stream para videos
      // Por ahora usamos direct upload con tus-resumable
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
            'Tus-Resumable': '1.0.0',
            'Upload-Length': file.size.toString(),
            'Upload-Metadata': `name ${btoa(file.name)},type ${btoa(file.type)}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        apiLogger.error({ 
          status: response.status, 
          errors: errorData.errors,
          userId: session.userId,
        }, 'Cloudflare Stream upload init failed')
        return ApiErrors.externalError('Cloudflare Stream')
      }

      // Obtener la URL de upload del header
      const uploadUrl = response.headers.get('location')
      const streamMediaId = response.headers.get('stream-media-id')

      if (!uploadUrl) {
        return ApiErrors.externalError('Cloudflare Stream - no upload URL')
      }

      // Subir el video
      const buffer = await file.arrayBuffer()
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': '0',
          'Content-Type': 'application/offset+octet-stream',
        },
        body: buffer,
      })

      if (!uploadResponse.ok) {
        apiLogger.error({ 
          status: uploadResponse.status,
          userId: session.userId,
        }, 'Cloudflare Stream upload failed')
        return ApiErrors.externalError('Cloudflare Stream')
      }

      // La URL del video será algo como: https://customer-{code}.cloudflarestream.com/{video-id}/manifest/video.m3u8
      // Para embed en Farcaster necesitamos el MP4 directo
      const videoUrl = `https://customer-${CF_ACCOUNT_ID}.cloudflarestream.com/${streamMediaId}/downloads/default.mp4`

      console.log('[Upload] Video uploaded:', videoUrl)

      return success({
        url: videoUrl,
        type: 'video',
        id: streamMediaId,
      })
    }

  } catch (error) {
    console.error('[Upload] Error:', error instanceof Error ? error.message : 'Unknown error')
    return ApiErrors.operationFailed('Failed to upload file')
  }
}
