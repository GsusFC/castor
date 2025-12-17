/**
 * Cloudflare Worker - Video Proxy
 * Proxea requests de video.castorapp.xyz a Cloudflare Stream
 * 
 * Deploy: wrangler deploy
 * Config: Añadir custom domain video.castorapp.xyz al worker
 */

const CLOUDFLARE_STREAM_DOMAIN = 'customer-l9k1ruqd8kemqqty.cloudflarestream.com'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    
    let pathname = url.pathname
    if (pathname.endsWith('/manifest/thumbnail.jpg')) {
      pathname = pathname.replace('/manifest/thumbnail.jpg', '/thumbnails/thumbnail.jpg')
    } else if (pathname.endsWith('/thumbnail.jpg') && !pathname.includes('/thumbnails/')) {
      pathname = pathname.replace('/thumbnail.jpg', '/thumbnails/thumbnail.jpg')
    }

    // Construir URL de Cloudflare Stream
    const streamUrl = `https://${CLOUDFLARE_STREAM_DOMAIN}${pathname}${url.search}`
    
    // Hacer request a Cloudflare Stream
    const response = await fetch(streamUrl, {
      method: request.method,
      headers: request.headers,
    })
    
    // Clonar response con headers CORS
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  },
}
