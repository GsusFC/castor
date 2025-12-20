import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { env } from '@/lib/env'

const LIVEPEER_API_KEY = env.LIVEPEER_API_KEY

/**
 * GET /api/media/livepeer/status?assetId=xxx
 * Verifica el estado de procesamiento de un video en Livepeer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    if (!LIVEPEER_API_KEY) {
      return ApiErrors.operationFailed('Video service not configured')
    }

    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')

    if (!assetId) {
      return ApiErrors.validationFailed([
        { field: 'assetId', message: 'assetId is required' }
      ])
    }

    const response = await fetch(`https://livepeer.studio/api/asset/${assetId}`, {
      headers: {
        'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return ApiErrors.notFound('Asset')
      }
      return ApiErrors.operationFailed('Failed to get asset status')
    }

    const asset = await response.json()

    // Estados de Livepeer: waiting, processing, ready, failed
    const status = asset.status?.phase || 'waiting'
    const isReady = status === 'ready'

    // Construir URLs de playback
    const playbackId = asset.playbackId
    let hlsUrl: string | null = null
    let mp4Url: string | null = null

    if (playbackId && isReady) {
      hlsUrl = `https://lp-playback.studio/hls/${playbackId}/index.m3u8`
      
      // Livepeer también proporciona MP4 estático si está disponible
      if (asset.downloadUrl) {
        mp4Url = asset.downloadUrl
      }
    }

    console.log('[Livepeer] Asset status:', {
      assetId,
      status,
      isReady,
      playbackId,
      hlsUrl,
    })

    return success({
      assetId,
      playbackId,
      status,
      isReady,
      hlsUrl,
      mp4Url,
      // URL principal para usar en embeds
      url: hlsUrl || (playbackId ? `https://lp-playback.studio/hls/${playbackId}/index.m3u8` : null),
    })

  } catch (error) {
    console.error('[Livepeer] Status error:', error)
    return ApiErrors.operationFailed('Failed to get asset status')
  }
}
