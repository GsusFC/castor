import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiLogger, createTimer } from '@/lib/logger'

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dqzhacfga'
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'castor_uploads'

export async function POST(request: NextRequest) {
  const timer = createTimer()

  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
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

    // Subir a Cloudinary
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`

    const cloudinaryFormData = new FormData()
    cloudinaryFormData.append('file', dataUri)
    cloudinaryFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

    const resourceType = isVideo ? 'video' : 'image'
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      { method: 'POST', body: cloudinaryFormData }
    )

    if (!response.ok) {
      const errorText = await response.text()
      apiLogger.error({ 
        status: response.status, 
        error: errorText,
        userId: session.userId,
      }, 'Cloudinary upload failed')
      return ApiErrors.externalError('Cloudinary')
    }

    const data = await response.json()

    apiLogger.info({
      userId: session.userId,
      type: isVideo ? 'video' : 'image',
      size: file.size,
      duration: timer.elapsed(),
    }, 'Media uploaded successfully')

    return success({
      url: data.secure_url,
      type: isVideo ? 'video' : 'image',
    })

  } catch (error) {
    apiLogger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: timer.elapsed(),
    }, 'Media upload failed')
    return ApiErrors.operationFailed('Failed to upload file')
  }
}
