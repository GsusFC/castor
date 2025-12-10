import { NextRequest, NextResponse } from 'next/server'

interface UrlMetadata {
  url: string
  title?: string
  description?: string
  image?: string
  favicon?: string
}

function extractMetaContent(html: string, property: string): string | undefined {
  // Try og: prefix first
  const ogPattern = new RegExp(
    `<meta[^>]*(?:property|name)=["']og:${property}["'][^>]*content=["']([^"']+)["']`,
    'i'
  )
  const ogMatch = html.match(ogPattern)
  if (ogMatch) return ogMatch[1]

  // Try reverse order (content before property)
  const ogReversePattern = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:${property}["']`,
    'i'
  )
  const ogReverseMatch = html.match(ogReversePattern)
  if (ogReverseMatch) return ogReverseMatch[1]

  // Try twitter: prefix
  const twitterPattern = new RegExp(
    `<meta[^>]*(?:property|name)=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`,
    'i'
  )
  const twitterMatch = html.match(twitterPattern)
  if (twitterMatch) return twitterMatch[1]

  return undefined
}

function extractTitle(html: string): string | undefined {
  // Try OG title first
  const ogTitle = extractMetaContent(html, 'title')
  if (ogTitle) return ogTitle

  // Fallback to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch ? titleMatch[1].trim() : undefined
}

function extractFavicon(html: string, baseUrl: string): string | undefined {
  // Try to find favicon link
  const patterns = [
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      const href = match[1]
      // Make absolute URL if relative
      if (href.startsWith('http')) return href
      if (href.startsWith('//')) return `https:${href}`
      if (href.startsWith('/')) {
        try {
          const url = new URL(baseUrl)
          return `${url.origin}${href}`
        } catch {
          return undefined
        }
      }
      return undefined
    }
  }

  // Fallback to /favicon.ico
  try {
    const url = new URL(baseUrl)
    return `${url.origin}/favicon.ico`
  } catch {
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'URL is required', metadata: null },
      { status: 400 }
    )
  }

  // Solo procesar URLs HTTP/HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return NextResponse.json(
      { error: 'Only HTTP/HTTPS URLs are supported', metadata: null },
      { status: 400 }
    )
  }

  try {
    // Fetch the URL with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CastorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch URL', metadata: null },
        { status: 400 }
      )
    }

    const html = await response.text()

    const metadata: UrlMetadata = {
      url,
      title: extractTitle(html),
      description: extractMetaContent(html, 'description'),
      image: extractMetaContent(html, 'image'),
      favicon: extractFavicon(html, url),
    }

    return NextResponse.json(
      { metadata },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  } catch (error) {
    console.error('[Embeds Metadata] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metadata', metadata: null },
      { status: 500 }
    )
  }
}
