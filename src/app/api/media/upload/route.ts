import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateFileMagicBytes, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } from '@/lib/media-validation'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

// Configuración de webhooks de Cloudflare Stream
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cloudflare-stream`
  : null

export async function POST(request: NextRequest) {

  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Verificar configuración de Cloudflare
    if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      console.error('[Upload] Cloudflare not configured')
      return ApiErrors.operationFailed('Media upload not configured')
    }

    // Rate limiting estricto para uploads (operación costosa)
    const rateLimit = await checkRateLimit(`upload:${session.userId}`, 'expensive')
    if (!rateLimit.success) {
      console.warn('[Upload] Rate limit exceeded:', session.userId)
      return ApiErrors.rateLimited()
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return ApiErrors.validationFailed([{ field: 'file', message: 'No file provided' }])
    }

    // Validar tipo de archivo declarado
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)

    if (!isImage && !isVideo) {
      return ApiErrors.validationFailed([{ 
        field: 'file', 
        message: 'Unsupported file type. Use JPG, PNG, GIF, WebP, MP4, MOV or WebM.' 
      }])
    }

    // Validar magic bytes (previene archivos maliciosos disfrazados)
    const magicValidation = await validateFileMagicBytes(file, file.type)
    if (!magicValidation.valid) {
      console.warn('[Upload] Magic bytes validation failed:', magicValidation.error)
      return ApiErrors.validationFailed([{ 
        field: 'file', 
        message: magicValidation.error || 'Invalid file content'
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
        console.error('[Upload] Cloudflare Images failed:', response.status, data.errors)
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
      // Usamos direct upload con tus-resumable y procesamiento asíncrono via webhooks
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
        console.error('[Upload] Cloudflare Stream init failed:', response.status, errorData.errors)
        return ApiErrors.externalError('Cloudflare Stream')
      }

      // Obtener la URL de upload del header
      const uploadUrl = response.headers.get('location')
      const streamMediaId = response.headers.get('stream-media-id')

      if (!uploadUrl || !streamMediaId) {
        return ApiErrors.externalError('Cloudflare Stream - no upload URL or media ID')
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
        console.error('[Upload] Cloudflare Stream upload failed:', uploadResponse.status)
        return ApiErrors.externalError('Cloudflare Stream')
      }

      console.log('[Upload] Video uploaded to Cloudflare Stream:', streamMediaId)

      // Configurar webhook para notificaciones (si está configurado)
      if (WEBHOOK_URL) {
        try {
          const webhookRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${streamMediaId}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                meta: { name: file.name },
                requireSignedURLs: false,
                allowedOrigins: ['*'],
              }),
            }
          )
          
          if (!webhookRes.ok) {
            console.warn('[Upload] Could not update video settings')
          }
        } catch (err) {
          console.warn('[Upload] Error configuring video:', err)
        }
      }

      // Habilitar descargas MP4 inmediatamente (el webhook actualizará cuando esté listo)
      try {
        const enableDownloadsRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${streamMediaId}/downloads`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }
        )
        
        if (enableDownloadsRes.ok) {
          console.log('[Upload] Downloads enabled for video:', streamMediaId)
        } else {
          console.warn('[Upload] Could not enable downloads:', await enableDownloadsRes.text())
        }
      } catch (err) {
        console.warn('[Upload] Error enabling downloads:', err)
      }

      // Devolver inmediatamente con URL temporal (watch URL tiene OG tags)
      // El webhook actualizará la URL a MP4 cuando esté listo
      const watchUrl = `https://watch.cloudflarestream.com/${streamMediaId}`

      console.log('[Upload] Video upload initiated:', { 
        cloudflareId: streamMediaId, 
        watchUrl,
        webhookConfigured: !!WEBHOOK_URL,
      })

      return success({
        url: watchUrl, // URL temporal que funciona para preview
        type: 'video',
        id: streamMediaId,
        cloudflareId: streamMediaId,
        videoStatus: 'pending', // El webhook actualizará a 'ready'
        watchUrl,
      })
    }

  } catch (error) {
    console.error('[Upload] Error:', error)
    console.error('[Upload] Stack:', error instanceof Error ? error.stack : 'No stack')
    return ApiErrors.operationFailed('Failed to upload file')
  }
}
