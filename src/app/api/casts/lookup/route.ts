import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

/**
 * GET /api/casts/lookup?url=https://warpcast.com/...
 * GET /api/casts/lookup?hash=0x...
 * GET /api/casts/lookup?identifier=...&type=url|hash
 * Obtiene información de un cast por su URL o hash
 */

// Convertir URL de farcaster.xyz a warpcast.com
function normalizeUrl(url: string): string {
  // farcaster.xyz/username/0x... -> warpcast.com/username/0x...
  if (url.includes('farcaster.xyz')) {
    return url.replace('farcaster.xyz', 'warpcast.com')
  }
  return url
}

// Formatear respuesta del cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatResponse(castData: any) {
  return NextResponse.json({
    cast: {
      hash: castData.hash,
      text: castData.text,
      author: {
        fid: castData.author.fid,
        username: castData.author.username,
        display_name: castData.author.display_name,
        pfp_url: castData.author.pfp_url,
      },
      timestamp: castData.timestamp,
      embeds: castData.embeds,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // Soportar ambos formatos de parámetros
    let url = searchParams.get('url') || searchParams.get('identifier')
    const hash = searchParams.get('hash')
    const type = searchParams.get('type') // 'url' o 'hash'

    // Si type es 'hash', tratar identifier como hash
    if (type === 'hash' && url) {
      const response = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier: url,
        type: 'hash',
      })
      return formatResponse(response.cast)
    }

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
      // Normalizar URL (farcaster.xyz -> warpcast.com)
      const normalizedUrl = normalizeUrl(url)
      
      // Buscar por URL de Warpcast
      const response = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier: normalizedUrl,
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

    return formatResponse(castData)
  } catch (error) {
    console.error('[API] Error looking up cast:', error)
    return NextResponse.json(
      { error: 'Failed to lookup cast' },
      { status: 500 }
    )
  }
}
