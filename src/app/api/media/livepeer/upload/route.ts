import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'

const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY

/**
 * POST /api/media/livepeer/upload
 * Solicita una URL de upload a Livepeer usando TUS protocol
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    if (!LIVEPEER_API_KEY) {
      console.error('[Livepeer] API key not configured')
      return ApiErrors.operationFailed('Video service not configured')
    }

    const body = await request.json()
    const { fileName, fileSize } = body

    if (!fileName) {
      return ApiErrors.validationFailed([
        { field: 'fileName', message: 'fileName is required' }
      ])
    }

    console.log('[Livepeer] Requesting upload URL for:', fileName)

    // Crear asset en Livepeer
    const response = await fetch('https://livepeer.studio/api/asset/request-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('[Livepeer] Failed to request upload:', error)
      return ApiErrors.operationFailed('Failed to request video upload')
    }

    const data = await response.json()
    
    console.log('[Livepeer] Upload URL created:', {
      assetId: data.asset?.id,
      playbackId: data.asset?.playbackId,
      tusEndpoint: data.tusEndpoint,
    })

    return success({
      uploadUrl: data.tusEndpoint,
      assetId: data.asset?.id,
      playbackId: data.asset?.playbackId,
      // URL de playback que Warpcast puede renderizar
      playbackUrl: data.asset?.playbackId 
        ? `https://lp-playback.studio/hls/${data.asset.playbackId}/index.m3u8`
        : null,
    })

  } catch (error) {
    console.error('[Livepeer] Error:', error)
    return ApiErrors.operationFailed('Failed to process upload request')
  }
}
