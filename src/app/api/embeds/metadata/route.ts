import { NextRequest, NextResponse } from 'next/server'
import { assertUrlIsSafe } from '@/lib/ssrf'
import { normalizeHttpUrl } from '@/lib/url-utils'

interface UrlMetadata {
  url: string
  title?: string
  description?: string
  image?: string
  favicon?: string
}

const MAX_HTML_BYTES = 1024 * 1024 // 1MB
const FETCH_TIMEOUT_MS = 5000
const MAX_REDIRECTS = 2

async function fetchWithRedirects(url: URL): Promise<Response> {
  let current = url
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertUrlIsSafe(current)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(current.toString(), {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CastorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }).finally(() => clearTimeout(timeoutId))

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return response

      const nextUrl = new URL(location, current)
      current = nextUrl
      continue
    }

    return response
  }

  throw new Error('Too many redirects')
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

  const normalizedUrl = normalizeHttpUrl(url)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(normalizedUrl)
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL', metadata: null },
      { status: 400 }
    )
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'Only HTTP/HTTPS URLs are supported', metadata: null },
      { status: 400 }
    )
  }

  try {
    const response = await fetchWithRedirects(parsedUrl)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch URL', metadata: null },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('text/html')) {
      return NextResponse.json(
        { error: 'URL did not return HTML', metadata: null },
        { status: 400 }
      )
    }

    const contentLengthHeader = response.headers.get('content-length')
    if (contentLengthHeader) {
      const len = Number(contentLengthHeader)
      if (Number.isFinite(len) && len > MAX_HTML_BYTES) {
        return NextResponse.json(
          { error: 'Response too large', metadata: null },
          { status: 400 }
        )
      }
    }

    const reader = response.body?.getReader()
    if (!reader) {
      return NextResponse.json(
        { error: 'Failed to read response', metadata: null },
        { status: 500 }
      )
    }

    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      received += value.byteLength
      if (received > MAX_HTML_BYTES) {
        return NextResponse.json(
          { error: 'Response too large', metadata: null },
          { status: 400 }
        )
      }
      chunks.push(value)
    }

    const html = new TextDecoder('utf-8').decode(Buffer.concat(chunks))

    const metadata: UrlMetadata = {
      url: parsedUrl.toString(),
      title: extractTitle(html),
      description: extractMetaContent(html, 'description'),
      image: extractMetaContent(html, 'image'),
      favicon: extractFavicon(html, parsedUrl.toString()),
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
