import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'caster_auth'

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/', '/login', '/api/auth', '/api/cron', '/api/channels', '/api/accounts', '/api/casts', '/api/media']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir rutas públicas (exactas o prefijos)
  if (pathname === '/' || publicRoutes.some(route => route !== '/' && pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Permitir assets estáticos
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/brand')) {
    return NextResponse.next()
  }

  // Verificar cookie de autenticación
  const authCookie = request.cookies.get(AUTH_COOKIE)

  if (!authCookie?.value) {
    // Redirigir a login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Verificar que la sesión no haya expirado
  try {
    const session = JSON.parse(authCookie.value)
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  } catch {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
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
