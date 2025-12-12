import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

// ============================================
// Types
// ============================================

export interface AuthUser {
  userId: string
  fid: number
  username: string
  displayName: string
  pfpUrl: string
  role: 'admin' | 'member'
}

export interface Session {
  user: AuthUser
  expiresAt: string
}

// ============================================
// Configuration
// ============================================

const AUTH_COOKIE = 'castor_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

function getSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    // En desarrollo, usar un secret por defecto (NO usar en producción)
    if (process.env.NODE_ENV === 'development') {
      return new TextEncoder().encode('castor-dev-secret-key-min-32-chars!')
    }
    throw new Error('SESSION_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
}

// ============================================
// Session Management
// ============================================

// Tiempo mínimo antes de renovar (1 día)
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000

/**
 * Obtiene la sesión actual del usuario
 * Implementa sliding sessions: renueva el token si está próximo a expirar
 */
export async function getSession(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(AUTH_COOKIE)?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, getSecretKey())
    const session = payload as unknown as Session

    // Verificar expiración
    const expiresAt = new Date(session.expiresAt)
    if (expiresAt < new Date()) {
      return null
    }

    // Sliding session: renovar si expira en menos de 1 día
    const timeUntilExpiry = expiresAt.getTime() - Date.now()
    if (timeUntilExpiry < REFRESH_THRESHOLD_MS) {
      // Renovar sesión en background (no bloquear)
      refreshSession(session.user).catch(() => {})
    }

    return session.user
  } catch (error) {
    // Token inválido o expirado
    return null
  }
}

/**
 * Renueva la sesión actual
 */
async function refreshSession(user: AuthUser): Promise<void> {
  await createSession(user)
}

/**
 * Crea una nueva sesión para el usuario
 */
export async function createSession(user: AuthUser): Promise<void> {
  const cookieStore = await cookies()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  const token = await new SignJWT({
    user,
    expiresAt: expiresAt.toISOString(),
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey())

  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

/**
 * Destruye la sesión actual
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE)
}

// ============================================
// API Route Helpers
// ============================================

type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Promise<T>; session: AuthUser }
) => Promise<NextResponse>

/**
 * Wrapper para proteger rutas API con autenticación
 */
export function withAuth<T = unknown>(handler: ApiHandler<T>) {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    return handler(request, { ...context, session })
  }
}

/**
 * Wrapper para rutas que requieren rol admin
 */
export function withAdmin<T = unknown>(handler: ApiHandler<T>) {
  return withAuth<T>(async (request, context) => {
    if (context.session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      )
    }

    return handler(request, context)
  })
}

// ============================================
// Permission Helpers
// ============================================

interface PermissionContext {
  ownerId: string | null
  isMember: boolean
}

/**
 * Verifica si el usuario tiene acceso a un recurso
 */
export function canAccess(session: AuthUser, resource: PermissionContext): boolean {
  // Admins tienen acceso a todo
  if (session.role === 'admin') return true
  
  // Owner tiene acceso
  if (resource.ownerId === session.userId) return true
  
  // Miembros explícitos via accountMembers
  if (resource.isMember) return true
  
  return false
}

/**
 * Verifica si el usuario puede modificar un recurso
 */
export function canModify(session: AuthUser, resource: PermissionContext): boolean {
  // Admins pueden modificar todo
  if (session.role === 'admin') return true
  
  // Owner puede modificar
  if (resource.ownerId === session.userId) return true

  if (resource.isMember) return true
  
  return false
}
