import { NextRequest, NextResponse } from 'next/server'
import { db, scheduledCasts, accounts, accountMembers } from '@/lib/db'
import { and, eq, desc, asc, or, inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

 type PublicAccount = {
   id: string
   username: string
   displayName: string | null
   pfpUrl: string | null
 }

 const toPublicAccount = (account: PublicAccount): PublicAccount => ({
   id: account.id,
   username: account.username,
   displayName: account.displayName,
   pfpUrl: account.pfpUrl,
 })

/**
 * GET /api/casts
 * Lista todos los casts programados
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const statusesParam = searchParams.get('statuses')
    const accountId = searchParams.get('accountId')
    const orderByParam = searchParams.get('orderBy')
    const sortParam = searchParams.get('sort')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    const requestedStatuses = statusesParam
      ? statusesParam.split(',').map((item) => item.trim()).filter(Boolean)
      : status ? [status] : []

    const validOrderBy = orderByParam === 'publishedAt' ? 'publishedAt' : 'scheduledAt'
    const validSort = sortParam === 'asc' ? 'asc' : 'desc'
    const parsedLimit = Number(limitParam)
    const parsedOffset = Number(offsetParam)
    const hasPagination = Number.isFinite(parsedLimit) && parsedLimit > 0
    const limit = hasPagination ? Math.min(parsedLimit, 100) : undefined
    const paginatedLimit = hasPagination ? Math.min(parsedLimit, 100) : 0
    const offset = hasPagination && Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0

    const memberships = await db.query.accountMembers.findMany({
      where: eq(accountMembers.userId, session.userId),
      columns: {
        accountId: true,
      },
    })

    const memberAccountIds = memberships.map(m => m.accountId)

    const accessibleAccounts = await db.query.accounts.findMany({
      where: memberAccountIds.length > 0
        ? or(
            eq(accounts.ownerId, session.userId),
            inArray(accounts.id, memberAccountIds)
          )
        : eq(accounts.ownerId, session.userId),
      columns: {
        id: true,
      },
    })

    const accessibleAccountIds = accessibleAccounts.map(a => a.id)

    if (accountId && !accessibleAccountIds.includes(accountId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (accessibleAccountIds.length === 0) {
      return NextResponse.json({ casts: [] })
    }

    const casts = await db.query.scheduledCasts.findMany({
      where: and(
        inArray(scheduledCasts.accountId, accountId ? [accountId] : accessibleAccountIds),
        requestedStatuses.length > 0
          ? inArray(scheduledCasts.status, requestedStatuses as Array<typeof scheduledCasts.$inferSelect.status>)
          : undefined
      ),
      with: {
        account: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            pfpUrl: true,
          },
        },
      },
      orderBy: [
        validSort === 'asc'
          ? asc(validOrderBy === 'publishedAt' ? scheduledCasts.publishedAt : scheduledCasts.scheduledAt)
          : desc(validOrderBy === 'publishedAt' ? scheduledCasts.publishedAt : scheduledCasts.scheduledAt),
      ],
      limit: hasPagination ? paginatedLimit + 1 : undefined,
      offset: hasPagination ? offset : undefined,
    })

    const slicedCasts = hasPagination ? casts.slice(0, paginatedLimit) : casts
    const safeCasts = slicedCasts.map((cast) => ({
      ...cast,
      account: cast.account ? toPublicAccount(cast.account) : null,
    }))
    const hasMore = hasPagination ? casts.length > paginatedLimit : false

    return NextResponse.json({
      casts: safeCasts,
      hasMore,
      nextOffset: hasPagination ? offset + safeCasts.length : null,
    })
  } catch (error) {
    console.error('[API] Error fetching casts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch casts' },
      { status: 500 }
    )
  }
}
