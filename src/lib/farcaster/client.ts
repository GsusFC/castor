import { NeynarAPIClient } from '@neynar/nodejs-sdk'

export const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY! })

/**
 * Publicar un cast
 */
export async function publishCast(
  signerUuid: string,
  text: string,
  options?: {
    embeds?: Array<{ url: string }>
    channelId?: string
    parentHash?: string
  }
) {
  try {
    const response = await neynar.publishCast({
      signerUuid,
      text,
      embeds: options?.embeds,
      channelId: options?.channelId,
      parent: options?.parentHash,
    })

    return {
      success: true as const,
      hash: response.cast.hash,
      cast: response.cast,
    }
  } catch (error) {
    console.error('[Farcaster] Error publishing cast:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Crear un signer usando tu propia wallet de desarrollador
 * Esto genera la URL de aprobación sin necesitar Sponsored Signers de Neynar
 */
export async function createSigner() {
  try {
    const mnemonic = process.env.FARCASTER_DEVELOPER_MNEMONIC
    
    if (!mnemonic) {
      throw new Error('FARCASTER_DEVELOPER_MNEMONIC not configured')
    }

    // Usar el SDK de Neynar con mnemonic para crear signer con URL
    const deadline = Math.floor(Date.now() / 1000) + 86400 // 24 horas
    
    const signer = await neynar.createSignerAndRegisterSignedKey({
      farcasterDeveloperMnemonic: mnemonic,
      deadline,
    })

    console.log('[Farcaster] Signer created with mnemonic:', JSON.stringify(signer, null, 2))
    
    return {
      success: true as const,
      signer,
    }
  } catch (error) {
    console.error('[Farcaster] Error creating signer:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Obtener estado del signer
 */
export async function getSignerStatus(signerUuid: string) {
  try {
    const response = await neynar.lookupSigner({ signerUuid })
    return {
      success: true as const,
      signer: response,
    }
  } catch (error) {
    console.error('[Farcaster] Error looking up signer:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Obtener información de usuario por FID
 */
export async function getUserByFid(fid: number) {
  try {
    const response = await neynar.fetchBulkUsers({ fids: [fid] })
    const user = response.users[0]

    if (!user) {
      return {
        success: false as const,
        error: 'User not found',
      }
    }

    // Detectar si es Pro (suscripción activa)
    const isPro = (user as { pro?: { status?: string } }).pro?.status === 'subscribed'
    
    return {
      success: true as const,
      user: {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        isPremium: isPro,
      },
    }
  } catch (error) {
    console.error('[Farcaster] Error fetching user:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Buscar usuario por username
 */
export async function searchUser(query: string) {
  try {
    const response = await neynar.searchUser({ q: query, limit: 10 })
    return {
      success: true as const,
      users: response.result.users.map((user) => ({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
      })),
    }
  } catch (error) {
    console.error('[Farcaster] Error searching user:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
