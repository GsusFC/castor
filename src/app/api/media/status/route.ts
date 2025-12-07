import { NextRequest, NextResponse } from 'next/server'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_API_TOKEN = process.env.CLOUDFLARE_IMAGES_API_KEY

/**
 * GET /api/media/status
 * Verifica el estado de un video en Cloudflare Stream
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cloudflareId = searchParams.get('cloudflareId')

    if (!cloudflareId) {
      return NextResponse.json({
        isReady: false,
        error: 'cloudflareId is required'
      })
    }

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
      return NextResponse.json({
        isReady: false,
        error: 'Cloudflare not configured'
      })
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${cloudflareId}`,
      {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          isReady: false,
          status: 'not_found',
          error: 'Video not found'
        })
      }
      return NextResponse.json({
        isReady: false,
        status: 'error',
        error: 'Failed to get video status'
      })
    }

    const data = await response.json()
    const video = data.result

    // Estados de Cloudflare Stream: pendingupload, downloading, queued, inprogress, ready, error
    const status = video?.status?.state || 'pending'
    const isReady = status === 'ready'

    return NextResponse.json({
      cloudflareId,
      status,
      isReady,
      hlsUrl: video?.playback?.hls || null,
      mp4Url: video?.playback?.dash || null,
      thumbnailUrl: video?.thumbnail || null,
    })

  } catch (error) {
    console.error('[Media Status] Error:', error)
    return NextResponse.json({
      isReady: false,
      status: 'error',
      error: 'Failed to check status'
    })
  }
}
