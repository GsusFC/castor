import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiLogger } from '@/lib/logger'

// Hosts bloqueados para prevenir SSRF
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
  '100.100.100.200', // Alibaba metadata
]

// Regex para IPs privadas
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|fc00:|fd00:|fe80:)/i

function isBlockedHost(hostname: string): boolean {
  // Check exact matches
  if (BLOCKED_HOSTS.includes(hostname.toLowerCase())) {
    return true
  }
  // Check private IP ranges
  if (PRIVATE_IP_REGEX.test(hostname)) {
    return true
  }
  // Check if it ends with blocked domains
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return true
  }
  return false
}

/**
 * POST /api/og-metadata
 * Obtiene metadatos Open Graph de una URL
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(`og:${session.userId}`, 'api')
    if (!rateLimit.success) {
      return ApiErrors.rateLimited()
    }

    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return ApiErrors.validationFailed([{ field: 'url', message: 'URL is required' }])
    }

    // Validar que es una URL válida
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return ApiErrors.validationFailed([{ field: 'url', message: 'Invalid URL format' }])
    }

    // Solo permitir HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ApiErrors.validationFailed([{ field: 'url', message: 'Only HTTP/HTTPS URLs allowed' }])
    }

    // Verificar SSRF
    if (isBlockedHost(parsedUrl.hostname)) {
      apiLogger.warn({ url, userId: session.userId }, 'Blocked SSRF attempt')
      return ApiErrors.validationFailed([{ field: 'url', message: 'URL not allowed' }])
    }

    // Fetch con timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Castor/1.0 (Open Graph Fetcher)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json({ 
        url,
        siteName: parsedUrl.hostname.replace(/^www\./, ''),
        favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`,
      })
    }

    const html = await response.text()

    // Helper para extraer contenido de meta tags
    const getMetaContent = (property: string): string | undefined => {
      // Formato: <meta property="og:title" content="...">
      const regex1 = new RegExp(
        `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
        'i'
      )
      // Formato: <meta content="..." property="og:title">
      const regex2 = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        'i'
      )
      return regex1.exec(html)?.[1] || regex2.exec(html)?.[1]
    }

    // Extraer título del tag <title>
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)

    // Construir metadatos
    const title = getMetaContent('og:title') || 
                  getMetaContent('twitter:title') || 
                  titleMatch?.[1]?.trim()

    const description = getMetaContent('og:description') || 
                        getMetaContent('twitter:description') || 
                        getMetaContent('description')

    let image = getMetaContent('og:image') || 
                getMetaContent('twitter:image') ||
                getMetaContent('twitter:image:src')

    // Resolver URLs relativas de imagen
    if (image && !image.startsWith('http')) {
      image = new URL(image, url).href
    }

    const siteName = getMetaContent('og:site_name') || 
                     parsedUrl.hostname.replace(/^www\./, '')

    const metadata = {
      url,
      title: title?.substring(0, 200),
      description: description?.substring(0, 300),
      image,
      siteName,
      favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`,
    }

    return NextResponse.json(metadata)
  } catch (error) {
    console.error('[OG Metadata] Error:', error)
    
    // Devolver metadata básica en caso de error
    try {
      const { url } = await request.clone().json()
      const parsedUrl = new URL(url)
      return NextResponse.json({
        url,
        siteName: parsedUrl.hostname.replace(/^www\./, ''),
        favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`,
      })
    } catch {
      return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 })
    }
  }
}
