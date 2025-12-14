import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

/**
 * GET /api/casts/lookup?url=https://warpcast.com/...
 * GET /api/casts/lookup?hash=0x...
 * GET /api/casts/lookup?identifier=...&type=url|hash
 * Obtiene información de un cast por su URL o hash
 */

// Extraer hash de URL de Farcaster o Warpcast
function extractHashFromUrl(url: string): string | null {
  // Formato /~/ca/0x... (short link de farcaster.xyz)
  const caMatch = url.match(/\/~\/ca\/(0x[a-f0-9]+)/i)
  if (caMatch) return caMatch[1]
  
  // Formato /username/0x...
  const userMatch = url.match(/\/([^/]+)\/(0x[a-f0-9]+)/i)
  if (userMatch) return userMatch[2]
  
  return null
}

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
      reactions: {
        likes_count: castData.reactions?.likes_count || 0,
        recasts_count: castData.reactions?.recasts_count || 0,
      },
      replies: {
        count: castData.replies?.count || 0,
      },
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
    const silent = searchParams.get('silent') === '1' || searchParams.get('silent') === 'true'

    const respondNotFound = () => {
      return NextResponse.json(
        { error: 'Cast not found', cast: null },
        { status: silent ? 200 : 404 }
      )
    }

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
      // Intentar extraer hash de la URL (soporta /~/ca/ y /username/0x...)
      const extractedHash = extractHashFromUrl(url)
      
      if (extractedHash) {
        // Buscar por hash extraído
        try {
          const response = await neynar.lookupCastByHashOrWarpcastUrl({
            identifier: extractedHash,
            type: 'hash',
          })
          castData = response.cast
        } catch {
          // Cast no encontrado con ese hash
          return respondNotFound()
        }
      } else {
        // Normalizar URL (farcaster.xyz -> warpcast.com) y buscar por URL
        const normalizedUrl = normalizeUrl(url)
        const response = await neynar.lookupCastByHashOrWarpcastUrl({
          identifier: normalizedUrl,
          type: 'url',
        })
        castData = response.cast
      }
    }

    if (!castData) {
      return respondNotFound()
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
