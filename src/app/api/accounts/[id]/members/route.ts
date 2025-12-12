import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, users } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase()
}

async function canManageMembers(params: {
  accountId: string
  sessionUserId: string
  sessionRole: 'admin' | 'member'
}): Promise<boolean> {
  if (params.sessionRole === 'admin') return true

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, params.accountId),
    columns: {
      ownerId: true,
    },
  })

  if (!account) return false
  if (account.ownerId === params.sessionUserId) return true

  const membership = await db.query.accountMembers.findFirst({
    where: and(
      eq(accountMembers.accountId, params.accountId),
      eq(accountMembers.userId, params.sessionUserId)
    ),
    columns: {
      role: true,
    },
  })

  return membership?.role === 'admin'
}

async function canViewMembers(params: {
  accountId: string
  sessionUserId: string
  sessionRole: 'admin' | 'member'
}): Promise<boolean> {
  if (params.sessionRole === 'admin') return true

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, params.accountId),
    columns: {
      ownerId: true,
    },
  })

  if (!account) return false
  if (account.ownerId === params.sessionUserId) return true

  const membership = await db.query.accountMembers.findFirst({
    where: and(
      eq(accountMembers.accountId, params.accountId),
      eq(accountMembers.userId, params.sessionUserId)
    ),
    columns: {
      id: true,
    },
  })

  return !!membership
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    const canView = await canViewMembers({
      accountId,
      sessionUserId: session.userId,
      sessionRole: session.role,
    })

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: {
        type: true,
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (account.type === 'personal') {
      return NextResponse.json({ error: 'Personal accounts cannot have members' }, { status: 409 })
    }

    const members = await db.query.accountMembers.findMany({
      where: eq(accountMembers.accountId, accountId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            pfpUrl: true,
          },
        },
      },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('[Members] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    const canManage = await canManageMembers({
      accountId,
      sessionUserId: session.userId,
      sessionRole: session.role,
    })

    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as {
      username?: string
      role?: 'admin' | 'member'
      canEditContext?: boolean
    }

    const username = body.username ? normalizeUsername(body.username) : ''
    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 })
    }

    const role: 'admin' | 'member' = body.role === 'admin' ? 'admin' : 'member'
    const canEditContext = Boolean(body.canEditContext)

    const user = await db.query.users.findFirst({
      where: sql`lower(${users.username}) = ${username}`,
      columns: {
        id: true,
        username: true,
        displayName: true,
        pfpUrl: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found (must sign up in Castor first)' },
        { status: 404 }
      )
    }

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: {
        ownerId: true,
        type: true,
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (account.type === 'personal') {
      return NextResponse.json({ error: 'Personal accounts cannot have members' }, { status: 409 })
    }

    if (account.ownerId === user.id) {
      return NextResponse.json({ error: 'Owner is already the account owner' }, { status: 400 })
    }

    const existing = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, user.id)
      ),
      columns: {
        id: true,
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }

    const memberId = generateId()

    await db.insert(accountMembers).values({
      id: memberId,
      accountId,
      userId: user.id,
      role,
      canEditContext,
      invitedById: session.userId,
    })

    const member = await db.query.accountMembers.findFirst({
      where: eq(accountMembers.id, memberId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            pfpUrl: true,
          },
        },
      },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('[Members] POST error:', error)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}
