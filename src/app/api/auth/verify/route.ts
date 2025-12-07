import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { neynar } from '@/lib/farcaster/client'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { fid } = await request.json()

    if (!fid) {
      return NextResponse.json(
        { error: 'Missing fid' },
        { status: 400 }
      )
    }

    // Verificar si el FID está en la whitelist (Beta)
    const allowedFids = process.env.ALLOWED_FIDS?.split(',').map(Number) ?? []
    if (allowedFids.length > 0 && !allowedFids.includes(fid)) {
      return NextResponse.json(
        { error: 'Access restricted to beta users' },
        { status: 403 }
      )
    }

    // Obtener datos del usuario de Farcaster
    const userResponse = await neynar.fetchBulkUsers({ fids: [fid] })
    const farcasterUser = userResponse.users[0]

    if (!farcasterUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Buscar o crear usuario en nuestra DB
    let dbUser = await db.query.users.findFirst({
      where: eq(users.fid, fid),
    })

    if (!dbUser) {
      // Crear nuevo usuario
      const userId = crypto.randomUUID()
      await db.insert(users).values({
        id: userId,
        fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: farcasterUser.display_name,
        pfpUrl: farcasterUser.pfp_url,
        role: 'member', // Default: member. Promote to admin manually in DB
      })
      dbUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
    } else {
      // Actualizar datos del usuario
      await db.update(users)
        .set({
          username: farcasterUser.username,
          displayName: farcasterUser.display_name,
          pfpUrl: farcasterUser.pfp_url,
          updatedAt: new Date(),
        })
        .where(eq(users.fid, fid))
    }

    // Crear sesión con el ID de usuario de nuestra DB
    await createSession({
      userId: dbUser!.id,
      fid: farcasterUser.fid,
      username: farcasterUser.username,
      displayName: farcasterUser.display_name || farcasterUser.username,
      pfpUrl: farcasterUser.pfp_url || '',
      role: dbUser!.role,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser!.id,
        fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: farcasterUser.display_name,
        pfpUrl: farcasterUser.pfp_url,
        role: dbUser!.role,
      },
    })
  } catch (error) {
    console.error('[Auth] Verify error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Authentication failed', details: errorMessage },
      { status: 500 }
    )
  }
}
