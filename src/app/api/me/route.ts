import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({
      fid: session.fid,
      username: session.username,
      displayName: session.displayName,
      pfpUrl: session.pfpUrl,
    })
  } catch (error) {
    console.error('[Me API] Error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
