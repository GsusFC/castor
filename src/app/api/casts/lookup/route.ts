import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

/**
 * GET /api/casts/lookup?url=https://warpcast.com/...
 * Obtiene información de un cast por su URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const hash = searchParams.get('hash')

    if (!url && !hash) {
      return NextResponse.json(
        { error: 'url or hash is required' },
        { status: 400 }
      )
    }

    let castData

    if (hash) {
      // Buscar por hash directamente
      const response = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier: hash,
        type: 'hash',
      })
      castData = response.cast
    } else if (url) {
      // Buscar por URL de Warpcast
      const response = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier: url,
        type: 'url',
      })
      castData = response.cast
    }

    if (!castData) {
      return NextResponse.json(
        { error: 'Cast not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      cast: {
        hash: castData.hash,
        text: castData.text,
        author: {
          fid: castData.author.fid,
          username: castData.author.username,
          displayName: castData.author.display_name,
          pfpUrl: castData.author.pfp_url,
        },
        timestamp: castData.timestamp,
      },
    })
  } catch (error) {
    console.error('[API] Error looking up cast:', error)
    return NextResponse.json(
      { error: 'Failed to lookup cast' },
      { status: 500 }
    )
  }
}
