import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/media/validate-video
 * Valida si una URL de video es compatible con Warpcast
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({
        isValid: false,
        error: 'URL requerida'
      })
    }

    // Hacer HEAD request para obtener headers sin descargar el archivo
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Warpcast/1.0'
      }
    })

    if (!response.ok) {
      return NextResponse.json({
        isValid: false,
        error: `No accesible (${response.status})`,
        details: {
          accessible: false,
          statusCode: response.status
        }
      })
    }

    const contentType = response.headers.get('content-type') || ''
    const contentLength = response.headers.get('content-length')
    const size = contentLength ? parseInt(contentLength, 10) : undefined

    // Warpcast soporta estos formatos
    const validVideoTypes = [
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'application/vnd.apple.mpegurl', // HLS
      'application/x-mpegurl' // HLS alternativo
    ]

    const isValidType = validVideoTypes.some(type => 
      contentType.toLowerCase().includes(type.split('/')[1])
    )

    // También aceptar si la URL termina en .mp4
    const isMP4Url = url.toLowerCase().includes('.mp4') || 
      url.toLowerCase().includes('download.mp4')

    // Verificar tamaño (Warpcast tiene límite de ~100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    const isSizeOk = !size || size <= maxSize

    const isValid = (isValidType || isMP4Url) && isSizeOk

    let error: string | undefined
    if (!isValid) {
      if (!isValidType && !isMP4Url) {
        error = `Formato no soportado: ${contentType || 'desconocido'}`
      } else if (!isSizeOk) {
        error = `Archivo muy grande: ${Math.round((size || 0) / 1024 / 1024)}MB`
      }
    }

    return NextResponse.json({
      isValid,
      error,
      details: {
        contentType,
        size,
        accessible: true,
        isMP4: isMP4Url || contentType.includes('mp4'),
        isHLS: contentType.includes('mpegurl') || url.includes('.m3u8')
      }
    })

  } catch (error) {
    console.error('[Validate Video] Error:', error)
    return NextResponse.json({
      isValid: false,
      error: 'Error al verificar',
      details: {
        accessible: false
      }
    })
  }
}
