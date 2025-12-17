import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'
import https from 'node:https'
import { URL } from 'node:url'

export const runtime = 'nodejs'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

const cloudflarePostJson = async <T>(
  url: string,
  token: string,
  body: unknown
): Promise<{ status: number; data: T }> => {
  const parsedUrl = new URL(url)
  const requestBody = JSON.stringify(body)

  return await new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody).toString(),
        },
        timeout: 30000,
        family: 4,
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            const json = JSON.parse(text) as T
            resolve({ status: res.statusCode || 0, data: json })
          } catch (parseError) {
            reject(new Error(`Cloudflare response is not valid JSON (status ${res.statusCode || 0})`))
          }
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error('Cloudflare request timed out'))
    })

    req.on('error', reject)
    req.write(requestBody)
    req.end()
  })
}

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
    console.log('[Upload URL] Config check - Account ID:', CF_ACCOUNT_ID ? 'SET' : 'MISSING', '| Token:', CF_IMAGES_TOKEN ? `SET (${CF_IMAGES_TOKEN.substring(0, 8)}...)` : 'MISSING')
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
      // Cloudflare requiere multipart/form-data para este endpoint
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
        console.error('[Upload URL] Cloudflare Images direct upload failed:', response.status, JSON.stringify(data))
        return ApiErrors.externalError('Cloudflare Images', data.errors)
      }

      console.log('[Upload URL] Image upload URL created:', data.result.id)

      return success({
        type: 'image',
        uploadUrl: data.result.uploadURL,
        id: data.result.id,
      })

    } else {
      // Para videos, usar direct_upload (HTTP simple, mejor soporte CORS)
      const { status, data } = await cloudflarePostJson<any>(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`,
        CF_IMAGES_TOKEN,
        {
          maxDurationSeconds: 3600,
          allowedOrigins: ['*'],
          requireSignedURLs: false,
          meta: { name: fileName },
        }
      )

      if (status < 200 || status >= 300 || !data?.success) {
        console.error('[Upload URL] Cloudflare Stream init failed:', status, JSON.stringify(data, null, 2))
        return ApiErrors.externalError('Cloudflare Stream', data?.errors?.[0]?.message || `Status ${status}`)
      }

      const uploadUrl = data.result?.uploadURL
      const streamMediaId = data.result?.uid

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

      if (!uploadUrl || !streamMediaId) {
        console.error('[Upload URL] No upload URL or media ID in response')
        return ApiErrors.externalError('Cloudflare Stream - no upload URL')
      }

      console.log('[Upload URL] Video upload URL created:', streamMediaId)

      return success({
        type: 'video',
        uploadUrl: normalizedUploadUrl,
        id: streamMediaId,
        cloudflareId: streamMediaId,
      })
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Upload URL] Error:', error)
    return ApiErrors.operationFailed(`Failed to create upload URL: ${message}`)
  }
}
