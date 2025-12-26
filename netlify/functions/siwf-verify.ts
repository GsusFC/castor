import type { Handler } from '@netlify/functions'
import { parseSiweMessage } from 'viem/siwe'
import { createAppClient, viemConnector } from '@farcaster/auth-client'

const FARCASTER_RELAY_URL = 'https://relay.farcaster.xyz'
const OPTIMISM_MAINNET_RPC_URL = 'https://mainnet.optimism.io'

const appClient = createAppClient({
  relay: FARCASTER_RELAY_URL,
  ethereum: viemConnector({ rpcUrl: OPTIMISM_MAINNET_RPC_URL }),
})

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

const jsonHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

type VerifyRequestBody = {
  nonce?: string
  domain?: string
  message?: string
  signature?: string
  acceptAuthAddress?: boolean
}

const parseAllowedFids = (value: string | undefined): number[] => {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0)
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, fid: null, isError: true, error: 'Method not allowed' }),
    }
  }

  const body = (() => {
    try {
      return event.body ? (JSON.parse(event.body) as VerifyRequestBody) : null
    } catch {
      return null
    }
  })()

  const message = body?.message
  const signature = body?.signature
  const acceptAuthAddress = body?.acceptAuthAddress ?? true
  const requestedDomain = typeof body?.domain === 'string' ? body.domain.trim() : null
  const requestedNonce = typeof body?.nonce === 'string' ? body.nonce.trim() : null

  if (typeof message !== 'string' || message.trim().length === 0) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, fid: null, isError: true, error: 'message is required' }),
    }
  }

  if (typeof signature !== 'string' || !signature.startsWith('0x')) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, fid: null, isError: true, error: 'signature is required' }),
    }
  }

  let siwe: ReturnType<typeof parseSiweMessage>
  try {
    siwe = parseSiweMessage(message)
  } catch {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, fid: null, isError: true, error: 'Invalid SIWF message' }),
    }
  }

  const domain = siwe.domain
  const nonce = siwe.nonce

  if (!domain || !nonce) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, fid: null, isError: true, error: 'Invalid SIWF payload' }),
    }
  }

  const expectedDomain = (process.env.SIWF_DOMAIN ?? '').trim()
  if (process.env.NODE_ENV === 'production' && expectedDomain.length === 0) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        fid: null,
        isError: true,
        error: 'Server misconfigured (missing SIWF_DOMAIN)',
      }),
    }
  }

  if (expectedDomain.length > 0 && domain !== expectedDomain) {
    return {
      statusCode: 403,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        fid: null,
        isError: true,
        error: 'Domain not allowed',
      }),
    }
  }

  if (requestedDomain && requestedDomain.length > 0 && requestedDomain !== domain) {
    return {
      statusCode: 403,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        fid: null,
        isError: true,
        error: 'Domain mismatch',
      }),
    }
  }

  if (requestedNonce && requestedNonce.length > 0 && requestedNonce !== nonce) {
    return {
      statusCode: 403,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        fid: null,
        isError: true,
        error: 'Nonce mismatch',
      }),
    }
  }

  const allowedFids = parseAllowedFids(process.env.ALLOWED_FIDS)

  try {
    const verify = await appClient.verifySignInMessage({
      nonce,
      domain,
      message,
      signature: signature as `0x${string}`,
      acceptAuthAddress,
    })

    if (verify.isError || !verify.success) {
      return {
        statusCode: 403,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          fid: null,
          isError: true,
          error: 'Invalid Sign In With Farcaster signature',
        }),
      }
    }

    const fid = verify.fid
    if (!Number.isInteger(fid) || fid <= 0) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, fid: null, isError: true, error: 'Invalid fid' }),
      }
    }

    if (allowedFids.length > 0 && !allowedFids.includes(fid)) {
      return {
        statusCode: 403,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, fid: null, isError: true, error: 'Access restricted to beta users' }),
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ success: true, fid, isError: false, error: null }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        fid: null,
        isError: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
