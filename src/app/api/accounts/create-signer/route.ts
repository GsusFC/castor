import { createSigner } from '@/lib/farcaster'
import { getSession } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { env } from '@/lib/env'

/**
 * POST /api/accounts/create-signer
 * Crea un nuevo signer para conectar una cuenta de Farcaster
 */
export async function POST() {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const result = await createSigner()

    if (!result.success) {
      return ApiErrors.externalError('Neynar', result.error)
    }

    const signer = result.signer
    if (!signer) {
      return ApiErrors.operationFailed('Signer creation returned no data')
    }

    // Log sin datos sensibles en producción
    if (env.NODE_ENV === 'development') {
      console.log('[API] Signer created for user:', session.userId)
    }
    
    // La URL de aprobación viene directamente del SDK cuando usas mnemonic
    const deepLinkUrl = signer.signer_approval_url || 
      `https://client.warpcast.com/deeplinks/signed-key-request?token=${signer.signer_uuid}`
    
    return success({
      signerUuid: signer.signer_uuid,
      publicKey: signer.public_key,
      status: signer.status,
      deepLinkUrl,
    })
  } catch (error) {
    console.error('[API] Error creating signer:', error)
    return ApiErrors.operationFailed('Failed to create signer')
  }
}
