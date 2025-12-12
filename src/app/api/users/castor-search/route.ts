import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').trim().replace(/^@/, '').toLowerCase()

    if (query.length < 1) {
      return NextResponse.json({ users: [] })
    }

    const results = await db.query.users.findMany({
      where: sql`lower(${users.username}) like ${`%${query}%`}`,
      columns: {
        id: true,
        username: true,
        displayName: true,
        pfpUrl: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      limit: 10,
    })

    return NextResponse.json({ users: results })
  } catch (error) {
    console.error('[Castor Users Search] Error:', error)
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 })
  }
}
