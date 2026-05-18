import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

function cspValue(_nonce: string): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'self' https://relay.farcaster.xyz https://warpcast.com",
    "upgrade-insecure-requests",
  ].join('; ')
}

function withCSP(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', cspValue(nonce))
  return response
}

const AUTH_COOKIE = 'castor_session'
const NODE_ENV = process.env.NODE_ENV ?? 'development'

// Rutas completamente públicas (no requieren autenticación)
const publicPaths = [
  '/landing',
  '/login',
  ...(NODE_ENV !== 'production'
    ? ['/__error-boundary-test', '/__global-error-test', '/error-boundary-test', '/global-error-test']
    : []),
]

// Prefijos de rutas públicas
const publicPrefixes = [
  '/api/auth/',      // Auth endpoints
  '/api/cron/',      // Cron jobs (protegidos por CRON_SECRET)
  '/.netlify/functions/', // Netlify Functions para debugging operativo
  '/_next/',         // Next.js assets
  '/favicon',        // Favicon
  '/brand/',         // Brand assets
]

// APIs que solo requieren autenticación para métodos que modifican
const readOnlyPublicApis = [
  '/api/channels',   // Listar canales es público
  '/api/feed',       // Feed es público para lectura
  '/api/users/',     // Perfiles de usuario son públicos
  '/api/search',     // Búsqueda es pública
  '/api/health',
  '/api/leaderboard',
]

// APIs que requieren auth pero POST es público (para AI)
const authPostApis = [
  '/api/ai/',        // AI endpoints
  '/api/me',         // User info
]

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length > 0) return new TextEncoder().encode(secret)

  if (NODE_ENV === 'development' || NODE_ENV === 'test') {
    return new TextEncoder().encode('castor-dev-secret-key-min-32-chars!')
  }

  throw new Error('SESSION_SECRET is required')
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce()

  const { pathname } = request.nextUrl
  const method = request.method
  const token = request.cookies.get(AUTH_COOKIE)?.value

  // /landing siempre debe permanecer accesible para permitir re-elegir versión

  // Si el usuario NO tiene sesión y accede a /, redirigir a landing
  if (pathname === '/' && !token) {
    return withCSP(NextResponse.rewrite(new URL('/landing', request.url)), nonce)
  }

  // Si el usuario tiene sesión y accede a /, redirigir a v2 si tiene cookie
  if (pathname === '/' && token) {
    try {
      await jwtVerify(token, getSecretKey())
      const versionPref = request.cookies.get('castor_studio_version')?.value
      if (versionPref === 'v2') {
        return withCSP(NextResponse.redirect(new URL('/v2/studio', request.url)), nonce)
      }
      if (versionPref === 'v1') {
        return withCSP(NextResponse.redirect(new URL('/studio', request.url)), nonce)
      }
      return withCSP(NextResponse.redirect(new URL('/landing', request.url)), nonce)
    } catch {
      // Token inválido, fall through
    }
  }

  // Permitir rutas completamente públicas
  if (publicPaths.includes(pathname)) {
    return withCSP(NextResponse.next(), nonce)
  }

  // Permitir prefijos públicos
  if (publicPrefixes.some(prefix => pathname.startsWith(prefix))) {
    return withCSP(NextResponse.next(), nonce)
  }

  // APIs de solo lectura: permitir GET sin auth
  if (readOnlyPublicApis.some(api => pathname.startsWith(api)) && method === 'GET') {
    return withCSP(NextResponse.next(), nonce)
  }

  // APIs que permiten POST con auth
  if (authPostApis.some(api => pathname.startsWith(api))) {
    return withCSP(NextResponse.next(), nonce)
  }

  // Verificar JWT para rutas protegidas
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return withCSP(NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      ), nonce)
    }
    return withCSP(NextResponse.redirect(new URL('/landing', request.url)), nonce)
  }

  try {
    await jwtVerify(token, getSecretKey())
    return withCSP(NextResponse.next(), nonce)
  } catch {
    if (pathname.startsWith('/api/')) {
      return withCSP(NextResponse.json(
        { error: 'Invalid session', code: 'AUTH_REQUIRED' },
        { status: 401 }
      ), nonce)
    }
    return withCSP(NextResponse.redirect(new URL('/landing', request.url)), nonce)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
