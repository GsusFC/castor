import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { parseSiweMessage } from 'viem/siwe'

import { createAppClient, viemConnector } from '@farcaster/auth-client'

import { createSession } from '@/lib/auth'
import { ApiErrors, success } from '@/lib/api/response'
import { db, users } from '@/lib/db'
import { env } from '@/lib/env'
import { getUserByFid } from '@/lib/farcaster'

const FARCASTER_RELAY_URL = 'https://relay.farcaster.xyz'
const OPTIMISM_MAINNET_RPC_URL = 'https://mainnet.optimism.io'

const appClient = createAppClient({
  relay: FARCASTER_RELAY_URL,
  ethereum: viemConnector({ rpcUrl: OPTIMISM_MAINNET_RPC_URL }),
})

const parseAllowedFids = (value: string | undefined): number[] => {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const message = body?.message
    const signature = body?.signature

    if (typeof message !== 'string' || message.trim().length === 0) {
      return ApiErrors.validationFailed([{ field: 'message', message: 'message is required' }])
    }

    if (typeof signature !== 'string' || !signature.startsWith('0x')) {
      return ApiErrors.validationFailed([
        { field: 'signature', message: 'signature is required' },
      ])
    }

    const signatureHex = signature as `0x${string}`

    let siwe: ReturnType<typeof parseSiweMessage>
    try {
      siwe = parseSiweMessage(message)
    } catch {
      return ApiErrors.validationFailed([{ field: 'message', message: 'Invalid SIWF message' }])
    }

    const domain = siwe.domain
    if (!domain) {
      return ApiErrors.validationFailed([{ field: 'domain', message: 'domain is required' }])
    }

    const nonce = siwe.nonce
    if (!nonce) {
      return ApiErrors.validationFailed([{ field: 'nonce', message: 'nonce is required' }])
    }

    const verify = await appClient.verifySignInMessage({
      nonce,
      domain,
      message,
      signature: signatureHex,
      acceptAuthAddress: true,
    })

    if (verify.isError || !verify.success) {
      return ApiErrors.forbidden('Invalid Sign In With Farcaster signature')
    }

    const fid = verify.fid
    if (!Number.isInteger(fid) || fid <= 0) {
      return ApiErrors.operationFailed('Verification returned an invalid fid')
    }

    const allowedFids = parseAllowedFids(env.ALLOWED_FIDS)
    if (allowedFids.length > 0 && !allowedFids.includes(fid)) {
      return ApiErrors.forbidden('Access restricted to beta users')
    }

    const userResult = await getUserByFid(fid)
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
      where: eq(users.fid, fid),
    })

    if (!dbUser) {
      const userId = crypto.randomUUID()
      await db.insert(users).values({
        id: userId,
        fid,
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
        .where(eq(users.fid, fid))
    }

    await createSession({
      userId: dbUser.id,
      fid,
      username: farcasterUser.username,
      displayName: farcasterUser.displayName || farcasterUser.username,
      pfpUrl: farcasterUser.pfpUrl || '',
      role: dbUser.role,
    })

    return success({
      user: {
        id: dbUser.id,
        fid,
        username: farcasterUser.username,
        displayName: farcasterUser.displayName,
        pfpUrl: farcasterUser.pfpUrl,
        role: dbUser.role,
      },
    })
  } catch (error) {
    return ApiErrors.operationFailed(
      'Failed to verify Sign In With Farcaster message',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
