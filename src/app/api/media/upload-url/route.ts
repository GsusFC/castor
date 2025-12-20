import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'

// Usar Node.js runtime para compatibilidad con librerías de logging (pino) y DB
export const runtime = 'nodejs'

const CF_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = env.CLOUDFLARE_IMAGES_API_KEY

const CLOUDFLARE_TIMEOUT_MS = 10_000

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

const parseJsonOrNull = (text: string) => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

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

      let response: Response
      try {
        response = await fetchWithTimeout(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${CF_IMAGES_TOKEN}`,
            },
            body: formData,
          },
          CLOUDFLARE_TIMEOUT_MS
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Upload URL] Cloudflare Images fetch failed:', message)
        return ApiErrors.operationFailed('Cloudflare Images API error', { message })
      }

      const responseText = await response.text()
      const data = parseJsonOrNull(responseText) as any

      if (!response.ok || !data?.success) {
        console.error('[Upload URL] Cloudflare Images failed:', response.status, responseText.slice(0, 500))
        return ApiErrors.operationFailed('Cloudflare Images API error', {
          status: response.status,
          body: responseText.slice(0, 500),
        })
      }

      const uploadUrl = data?.result?.uploadURL
      const cloudflareId = data?.result?.id

      if (!uploadUrl || !cloudflareId) {
        return ApiErrors.operationFailed('Cloudflare Images API error', {
          status: response.status,
          body: responseText.slice(0, 500),
        })
      }

      return success({
        type: 'image',
        uploadUrl,
        id: cloudflareId,
        cloudflareId,
      })

    } else {
      console.log('[Upload URL] Requesting Video Upload URL...')
      // Cloudflare Stream Direct Upload
      let response: Response
      try {
        response = await fetchWithTimeout(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${CF_IMAGES_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              maxDurationSeconds: 3600,
              allowedOrigins: ['*'],
              requireSignedURLs: false,
              meta: { name: fileName },
            }),
          },
          CLOUDFLARE_TIMEOUT_MS
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Upload URL] Cloudflare Stream fetch failed:', message)
        return ApiErrors.operationFailed('Cloudflare Stream API error', { message })
      }

      const responseText = await response.text()
      const data = parseJsonOrNull(responseText) as any

      if (!response.ok || !data?.success) {
        console.error('[Upload URL] Cloudflare Stream failed:', response.status, responseText.slice(0, 500))
        return ApiErrors.operationFailed('Cloudflare Stream API error', {
          status: response.status,
          body: responseText.slice(0, 500),
        })
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
