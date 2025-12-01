import { cookies } from 'next/headers'

const AUTH_COOKIE = 'caster_auth'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 días

export interface AuthUser {
  userId: string
  fid: number
  username: string
  displayName: string
  pfpUrl: string
  role: 'admin' | 'member'
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(AUTH_COOKIE)
  
  if (!session?.value) {
    return null
  }

  try {
    const data = JSON.parse(session.value)
    
    // Verificar expiración
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return null
    }
    
    return data.user as AuthUser
  } catch {
    return null
  }
}

export async function createSession(user: AuthUser): Promise<void> {
  const cookieStore = await cookies()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)
  
  cookieStore.set(AUTH_COOKIE, JSON.stringify({
    user,
    expiresAt: expiresAt.toISOString(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE)
}
