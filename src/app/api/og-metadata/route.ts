import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/og-metadata
 * Obtiene metadatos Open Graph de una URL
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validar que es una URL válida
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
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
