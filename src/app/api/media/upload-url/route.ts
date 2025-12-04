import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

/**
 * POST /api/media/upload-url
 * Genera una URL de upload directo a Cloudflare (TUS protocol)
 * El cliente sube directamente a Cloudflare sin pasar por nuestro servidor
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Verificar configuración de Cloudflare
    if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      console.error('[Upload URL] Cloudflare not configured')
      return ApiErrors.operationFailed('Media upload not configured')
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(`upload:${session.userId}`, 'expensive')
    if (!rateLimit.success) {
      console.warn('[Upload URL] Rate limit exceeded:', session.userId)
      return ApiErrors.rateLimited()
    }

    const body = await request.json()
    const { fileName, fileSize, fileType } = body

    if (!fileName || !fileSize || !fileType) {
      return ApiErrors.validationFailed([
        { field: 'fileName', message: 'fileName, fileSize and fileType are required' }
      ])
    }

    // Validar tipo de archivo
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm']
    const isImage = validImageTypes.includes(fileType)
    const isVideo = validVideoTypes.includes(fileType)

    if (!isImage && !isVideo) {
      return ApiErrors.validationFailed([{ 
        field: 'fileType', 
        message: 'Unsupported file type. Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.' 
      }])
    }

    // Validar tamaño
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (fileSize > maxSize) {
      return ApiErrors.validationFailed([{ 
        field: 'fileSize', 
        message: `File too large. Maximum ${isVideo ? '100MB' : '10MB'}.` 
      }])
    }

    if (isImage) {
      // Para imágenes, usar direct upload de Cloudflare Images
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requireSignedURLs: false,
            metadata: { fileName },
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[Upload URL] Cloudflare Images direct upload failed:', data.errors)
        return ApiErrors.externalError('Cloudflare Images')
      }

      console.log('[Upload URL] Image upload URL created:', data.result.id)

      return success({
        type: 'image',
        uploadUrl: data.result.uploadURL,
        id: data.result.id,
      })

    } else {
      // Para videos, usar TUS protocol de Cloudflare Stream
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
            'Tus-Resumable': '1.0.0',
            'Upload-Length': fileSize.toString(),
            'Upload-Metadata': `name ${btoa(fileName)},type ${btoa(fileType)}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[Upload URL] Cloudflare Stream init failed:', response.status, errorData.errors)
        return ApiErrors.externalError('Cloudflare Stream')
      }

      // Obtener la URL de upload del header
      const uploadUrl = response.headers.get('location')
      const streamMediaId = response.headers.get('stream-media-id')

      if (!uploadUrl || !streamMediaId) {
        console.error('[Upload URL] No upload URL or media ID in response')
        return ApiErrors.externalError('Cloudflare Stream - no upload URL')
      }

      console.log('[Upload URL] Video upload URL created:', streamMediaId)

      return success({
        type: 'video',
        uploadUrl,
        id: streamMediaId,
        cloudflareId: streamMediaId,
      })
    }

  } catch (error) {
    console.error('[Upload URL] Error:', error)
    return ApiErrors.operationFailed('Failed to create upload URL')
  }
}
