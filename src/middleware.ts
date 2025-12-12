import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const AUTH_COOKIE = 'castor_session'

// Rutas completamente públicas (no requieren autenticación)
const publicPaths = [
  '/landing',
  '/login',
]

// Prefijos de rutas públicas
const publicPrefixes = [
  '/api/auth/',      // Auth endpoints
  '/api/cron/',      // Cron jobs (protegidos por CRON_SECRET)
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
  '/api/leaderboard',
]

// APIs que requieren auth pero POST es público (para AI)
const authPostApis = [
  '/api/ai/',        // AI endpoints
  '/api/me',         // User info
]

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      return new TextEncoder().encode('castor-dev-secret-key-min-32-chars!')
    }
    throw new Error('SESSION_SECRET is required')
  }
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const token = request.cookies.get(AUTH_COOKIE)?.value

  // Si el usuario está en la landing y tiene sesión válida, redirigir al feed
  if (pathname === '/landing' && token) {
    try {
      await jwtVerify(token, getSecretKey())
      return NextResponse.redirect(new URL('/', request.url))
    } catch {
      // Token inválido, continuar a la landing
    }
  }

  // Si el usuario NO tiene sesión y accede a /, redirigir a landing
  if (pathname === '/' && !token) {
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  // Permitir rutas completamente públicas
  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Permitir prefijos públicos
  if (publicPrefixes.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // APIs de solo lectura: permitir GET sin auth
  if (readOnlyPublicApis.some(api => pathname.startsWith(api)) && method === 'GET') {
    return NextResponse.next()
  }

  // APIs que permiten POST con auth (verificar auth en el endpoint)
  if (authPostApis.some(api => pathname.startsWith(api))) {
    return NextResponse.next()
  }

  // Verificar JWT para rutas protegidas
  if (!token) {
    // Para APIs, devolver 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }
    // Para páginas, redirigir a landing
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  try {
    await jwtVerify(token, getSecretKey())
    return NextResponse.next()
  } catch {
    // Token inválido
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }
    return NextResponse.redirect(new URL('/landing', request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
