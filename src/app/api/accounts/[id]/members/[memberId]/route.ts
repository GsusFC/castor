import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId, memberId } = await context.params

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

    const requesterMembership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
      columns: {
        role: true,
      },
    })

    const canManage = session.role === 'admin' || account.ownerId === session.userId || requesterMembership?.role === 'admin'
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const member = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.id, memberId),
        eq(accountMembers.accountId, accountId)
      ),
      columns: {
        id: true,
        userId: true,
        role: true,
        canEditContext: true,
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.userId === account.ownerId || member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot modify account owner' }, { status: 400 })
    }

    const body = (await request.json()) as {
      role?: 'admin' | 'member'
      canEditContext?: boolean
    }

    const role: 'admin' | 'member' | undefined = body.role === 'admin' ? 'admin' : body.role === 'member' ? 'member' : undefined
    const canEditContext = body.canEditContext

    if (!role && canEditContext === undefined) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    await db
      .update(accountMembers)
      .set({
        ...(role && { role }),
        ...(canEditContext !== undefined && { canEditContext: Boolean(canEditContext) }),
      })
      .where(eq(accountMembers.id, memberId))

    const updated = await db.query.accountMembers.findFirst({
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

    return NextResponse.json({ member: updated })
  } catch (error) {
    console.error('[Members] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId, memberId } = await context.params

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

    const requesterMembership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
      columns: {
        role: true,
      },
    })

    const canManage = session.role === 'admin' || account.ownerId === session.userId || requesterMembership?.role === 'admin'
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const member = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.id, memberId),
        eq(accountMembers.accountId, accountId)
      ),
      columns: {
        id: true,
        userId: true,
        role: true,
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.userId === account.ownerId || member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove account owner' }, { status: 400 })
    }

    await db.delete(accountMembers).where(eq(accountMembers.id, memberId))

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[Members] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
