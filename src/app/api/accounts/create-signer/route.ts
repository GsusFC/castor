import { NextResponse } from 'next/server'
import { createSigner } from '@/lib/farcaster'

/**
 * POST /api/accounts/create-signer
 * Crea un nuevo signer para conectar una cuenta de Farcaster
 */
export async function POST() {
  try {
    const result = await createSigner()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const signer = result.signer
    if (!signer) {
      return NextResponse.json(
        { error: 'Signer creation returned no data' },
        { status: 500 }
      )
    }

    console.log('[API] Signer created:', JSON.stringify(signer, null, 2))
    
    // La URL de aprobación viene directamente del SDK cuando usas mnemonic
    const deepLinkUrl = signer.signer_approval_url || 
      `https://client.warpcast.com/deeplinks/signed-key-request?token=${signer.signer_uuid}`
    
    return NextResponse.json({
      signerUuid: signer.signer_uuid,
      publicKey: signer.public_key,
      status: signer.status,
      deepLinkUrl,
    })
  } catch (error) {
    console.error('[API] Error creating signer:', error)
    return NextResponse.json(
      { error: 'Failed to create signer' },
      { status: 500 }
    )
  }
}
