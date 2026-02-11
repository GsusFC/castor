import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, typefullySocialSets } from '@/lib/db'
import { getTypefullyConnectionForUser } from '@/lib/integrations/typefully-store'

interface RouteContext {
  params: Promise<{ socialSetId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await getTypefullyConnectionForUser(session.userId)
    if (!connection) {
      return NextResponse.json({ error: 'Typefully not connected' }, { status: 400 })
    }

    const { socialSetId } = await context.params
    const socialSetIdNum = Number(socialSetId)
    if (!Number.isInteger(socialSetIdNum)) {
      return NextResponse.json({ error: 'Invalid socialSetId' }, { status: 400 })
    }

    const body = await request.json().catch(() => null) as { accountId?: string } | null
    const accountId = body?.accountId?.trim()
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const socialSet = await db.query.typefullySocialSets.findFirst({
      where: and(
        eq(typefullySocialSets.connectionId, connection.id),
        eq(typefullySocialSets.socialSetId, socialSetIdNum)
      ),
    })

    if (!socialSet) {
      return NextResponse.json({ error: 'Social set not found. Sync social sets first.' }, { status: 404 })
    }

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { id: true, ownerId: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, session.userId)),
      columns: { id: true },
    })

    if (account.ownerId !== session.userId && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db
      .update(typefullySocialSets)
      .set({
        linkedAccountId: accountId,
        updatedAt: new Date(),
      })
      .where(eq(typefullySocialSets.id, socialSet.id))

    return NextResponse.json({ success: true, socialSetId: socialSetIdNum, accountId })
  } catch (error) {
    console.error('[Typefully Social Set Link] POST error:', error)
    return NextResponse.json({ error: 'Failed to link social set' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await getTypefullyConnectionForUser(session.userId)
    if (!connection) {
      return NextResponse.json({ error: 'Typefully not connected' }, { status: 400 })
    }

    const { socialSetId } = await context.params
    const socialSetIdNum = Number(socialSetId)
    if (!Number.isInteger(socialSetIdNum)) {
      return NextResponse.json({ error: 'Invalid socialSetId' }, { status: 400 })
    }

    const socialSet = await db.query.typefullySocialSets.findFirst({
      where: and(
        eq(typefullySocialSets.connectionId, connection.id),
        eq(typefullySocialSets.socialSetId, socialSetIdNum)
      ),
    })

    if (!socialSet) {
      return NextResponse.json({ error: 'Social set not found' }, { status: 404 })
    }

    await db
      .update(typefullySocialSets)
      .set({
        linkedAccountId: null,
        updatedAt: new Date(),
      })
      .where(eq(typefullySocialSets.id, socialSet.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Typefully Social Set Link] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to unlink social set' }, { status: 500 })
  }
}
