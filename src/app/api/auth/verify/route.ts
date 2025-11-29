import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { neynar } from '@/lib/farcaster/client'

export async function POST(request: NextRequest) {
  try {
    const { fid } = await request.json()

    if (!fid) {
      return NextResponse.json(
        { error: 'Missing fid' },
        { status: 400 }
      )
    }

    // Obtener datos del usuario
    const userResponse = await neynar.fetchBulkUsers({ fids: [fid] })
    const user = userResponse.users[0]

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Crear sesión
    await createSession({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name || user.username,
      pfpUrl: user.pfp_url || '',
    })

    return NextResponse.json({
      success: true,
      user: {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
      },
    })
  } catch (error) {
    console.error('[Auth] Verify error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
