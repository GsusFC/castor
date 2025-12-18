import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'

// Cambiar a Edge Runtime para mejor rendimiento y compatibilidad con fetch
export const runtime = 'edge'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

/**
 * POST /api/media/upload-url
 * Genera una URL de upload directo a Cloudflare (Images o Stream)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Upload URL] Starting request...')

    // 1. Verificar autenticación
    let session
    try {
      session = await getSession()
      if (!session) {
        console.warn('[Upload URL] No session found')
        return ApiErrors.unauthorized()
      }
    } catch (authError) {
      console.error('[Upload URL] Auth check failed:', authError)
      return ApiErrors.unauthorized()
    }

    // 2. Verificar configuración de Cloudflare
    if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
      console.error('[Upload URL] Cloudflare not configured (env vars missing)')
      return ApiErrors.operationFailed('Media upload not configured')
    }

    // 3. Rate limiting (Defensive / Fail Open)
    try {
      const rateLimit = await checkRateLimit(`upload:${session.userId}`, 'expensive')
      if (!rateLimit.success) {
        console.warn('[Upload URL] Rate limit exceeded:', session.userId)
        return ApiErrors.rateLimited()
      }
    } catch (limitError) {
      // Si falla Redis/RateLimit, permitimos la subida (Fail Open) para no bloquear usuarios
      console.error('[Upload URL] Rate limit check failed (ignoring):', limitError)
    }

    // 4. Parsear body
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error('[Upload URL] Invalid JSON body:', jsonError)
      return ApiErrors.badRequest('Invalid JSON body')
    }

    const { fileName, fileSize, fileType } = body

    if (!fileName || !fileSize || !fileType) {
      return ApiErrors.validationFailed([
        { field: 'fileName', message: 'fileName, fileSize and fileType are required' }
      ])
    }

    // 5. Validaciones
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

    // 6. Cloudflare API Calls
    if (isImage) {
      console.log('[Upload URL] Requesting Image Upload URL...')
      // Cloudflare Images Direct Upload
      const formData = new FormData()
      formData.append('requireSignedURLs', 'false')
      formData.append('metadata', JSON.stringify({ fileName }))

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
          },
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[Upload URL] Cloudflare Images failed:', response.status, data)
        return ApiErrors.externalError('Cloudflare Images', data.errors)
      }

      return success({
        type: 'image',
        uploadUrl: data.result.uploadURL,
        id: data.result.id,
      })

    } else {
      console.log('[Upload URL] Requesting Video Upload URL...')
      // Cloudflare Stream Direct Upload
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_IMAGES_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxDurationSeconds: 3600,
            allowedOrigins: ['*'],
            requireSignedURLs: false,
            meta: { name: fileName },
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[Upload URL] Cloudflare Stream failed:', response.status, data)
        return ApiErrors.externalError('Cloudflare Stream', data?.errors?.[0]?.message || 'Unknown error')
      }

      const uploadUrl = data.result?.uploadURL
      const streamMediaId = data.result?.uid

      // Normalizar URL de upload para evitar problemas de DNS en algunas redes
      const normalizedUploadUrl = (() => {
        if (!uploadUrl || typeof uploadUrl !== 'string') return uploadUrl
        try {
          const parsed = new URL(uploadUrl)
          if (parsed.hostname === 'upload.cloudflarestream.com') {
            parsed.hostname = 'upload.videodelivery.net'
          }
          return parsed.toString()
        } catch {
          return uploadUrl
        }
      })()

      return success({
        type: 'video',
        uploadUrl: normalizedUploadUrl,
        id: streamMediaId,
        cloudflareId: streamMediaId,
      })
    }

  } catch (error) {
    console.error('[Upload URL] Critical Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return ApiErrors.operationFailed(`Failed to create upload URL: ${message}`)
  }
}
