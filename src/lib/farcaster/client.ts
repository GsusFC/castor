import { NeynarAPIClient } from '@neynar/nodejs-sdk'

export const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY! })

/**
 * Valida formato básico de mnemonic BIP39
 * - Debe tener 12, 15, 18, 21 o 24 palabras
 * - Solo letras minúsculas y espacios
 */
function validateMnemonicFormat(mnemonic: string): { valid: boolean; error?: string } {
  const trimmed = mnemonic.trim()
  
  if (!trimmed) {
    return { valid: false, error: 'Mnemonic is empty' }
  }

  // Solo letras minúsculas y espacios
  if (!/^[a-z\s]+$/.test(trimmed)) {
    return { valid: false, error: 'Mnemonic contains invalid characters (should be lowercase words separated by spaces)' }
  }

  const words = trimmed.split(/\s+/)
  const validWordCounts = [12, 15, 18, 21, 24]
  
  if (!validWordCounts.includes(words.length)) {
    return { valid: false, error: `Mnemonic has ${words.length} words, expected one of: ${validWordCounts.join(', ')}` }
  }

  return { valid: true }
}

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
    console.log('[Farcaster] Publishing cast with:', {
      signerUuid,
      text: text.slice(0, 50),
      embeds: options?.embeds,
      channelId: options?.channelId,
    })
    
    const response = await neynar.publishCast({
      signerUuid,
      text,
      embeds: options?.embeds,
      channelId: options?.channelId,
      parent: options?.parentHash,
    })

    console.log('[Farcaster] Publish response:', {
      hash: response.cast.hash,
      embeds: (response.cast as { embeds?: unknown[] }).embeds,
      text: response.cast.text,
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

    // Validar formato del mnemonic
    const validation = validateMnemonicFormat(mnemonic)
    if (!validation.valid) {
      throw new Error(`Invalid mnemonic format: ${validation.error}`)
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
