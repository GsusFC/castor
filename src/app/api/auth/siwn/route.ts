import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'

import { createSession } from '@/lib/auth'
import { ApiErrors, success } from '@/lib/api/response'
import { db, users, accounts } from '@/lib/db'
import { env } from '@/lib/env'
import { getSignerStatus, getUserByFid } from '@/lib/farcaster'
import { generateId } from '@/lib/utils'

const parseSignerUuid = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

const parseFid = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value

  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isInteger(n) && n > 0) return n
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const signerUuid = parseSignerUuid(body?.signerUuid ?? body?.signer_uuid)
    const fidFromClient = parseFid(body?.fid)

    if (!signerUuid) {
      return ApiErrors.validationFailed([
        { field: 'signerUuid', message: 'signerUuid is required' },
      ])
    }

    const signerResult = await getSignerStatus(signerUuid)
    if (!signerResult.success) {
      return ApiErrors.externalError('Neynar', signerResult.error)
    }

    const signer = signerResult.signer

    if (signer.status !== 'approved' || !signer.fid) {
      return ApiErrors.forbidden('Signer is not approved')
    }

    if (fidFromClient !== null && fidFromClient !== signer.fid) {
      return ApiErrors.forbidden('Fid mismatch')
    }

    const allowedFids = env.ALLOWED_FIDS?.split(',').map(Number) ?? []
    if (allowedFids.length > 0 && !allowedFids.includes(signer.fid)) {
      return ApiErrors.forbidden('Access restricted to beta users')
    }

    const userResult = await getUserByFid(signer.fid)
    if (!userResult.success) {
      if (userResult.error === 'User not found') {
        return ApiErrors.notFound('User')
      }
      return ApiErrors.externalError('Neynar', userResult.error)
    }

    const farcasterUser = userResult.user

    const safeDisplayName = farcasterUser.displayName ?? null
    const safePfpUrl = farcasterUser.pfpUrl ?? null

    let dbUser = await db.query.users.findFirst({
      where: eq(users.fid, signer.fid),
    })

    if (!dbUser) {
      const userId = crypto.randomUUID()
      await db.insert(users).values({
        id: userId,
        fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: safeDisplayName,
        pfpUrl: safePfpUrl,
        role: 'member',
      })

      dbUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!dbUser) {
        return ApiErrors.operationFailed('Failed to create user')
      }
    } else {
      await db
        .update(users)
        .set({
          username: farcasterUser.username,
          displayName: safeDisplayName,
          pfpUrl: safePfpUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.fid, signer.fid))
    }

    if (!dbUser) {
      return ApiErrors.operationFailed('Failed to load user')
    }

    const dbUserId = dbUser.id
    const dbUserRole = dbUser.role

    const existingAccount = await db.query.accounts.findFirst({
      where: eq(accounts.fid, signer.fid),
    })

    if (!existingAccount) {
      await db.insert(accounts).values({
        id: generateId(),
        fid: signer.fid,
        username: farcasterUser.username,
        displayName: safeDisplayName,
        pfpUrl: safePfpUrl,
        signerUuid,
        signerStatus: 'approved',
        type: 'personal',
        isPremium: farcasterUser.isPremium,
        ownerId: dbUserId,
      })
    } else {
      await db
        .update(accounts)
        .set({
          username: farcasterUser.username,
          displayName: safeDisplayName,
          pfpUrl: safePfpUrl,
          signerUuid,
          signerStatus: 'approved',
          isPremium: farcasterUser.isPremium,
          ownerId: dbUserId,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existingAccount.id))
    }

    await createSession({
      userId: dbUserId,
      fid: farcasterUser.fid,
      username: farcasterUser.username,
      displayName: farcasterUser.displayName || farcasterUser.username,
      pfpUrl: farcasterUser.pfpUrl || '',
      role: dbUserRole,
    })

    return success({
      user: {
        id: dbUserId,
        fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: farcasterUser.displayName,
        pfpUrl: farcasterUser.pfpUrl,
        role: dbUserRole,
      },
      signer: {
        signerUuid,
        fid: signer.fid,
        status: signer.status,
      },
    })
  } catch (error) {
    console.error('[Auth SIWN] Error:', error)
    return ApiErrors.operationFailed('Authentication failed')
  }
}
