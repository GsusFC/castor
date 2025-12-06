/**
 * Validación de archivos multimedia por magic bytes
 * Previene subida de archivos maliciosos disfrazados
 */

// Magic bytes para tipos de archivo soportados
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  // Imágenes
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP
  ],
  // Videos
  'video/mp4': [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp
  ],
  'video/quicktime': [
    { bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], offset: 4 }, // ftypqt
    { bytes: [0x6D, 0x6F, 0x6F, 0x76], offset: 4 }, // moov
  ],
  'video/webm': [
    { bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML
  ],
}

/**
 * Verifica que los bytes del archivo coincidan con el tipo declarado
 */
export async function validateFileMagicBytes(
  file: File,
  declaredType: string
): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  try {
    // Leer primeros 16 bytes
    const buffer = await file.slice(0, 16).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Verificar el tipo declarado
    const expectedSignatures = MAGIC_BYTES[declaredType]
    if (!expectedSignatures) {
      return { valid: false, error: `Unsupported file type: ${declaredType}` }
    }

    // Verificar si los magic bytes coinciden
    const matches = expectedSignatures.every(sig => {
      const offset = sig.offset || 0
      return sig.bytes.every((byte, i) => bytes[offset + i] === byte)
    })

    if (matches) {
      return { valid: true, detectedType: declaredType }
    }

    // Intentar detectar el tipo real
    const detectedType = detectFileType(bytes)
    
    return {
      valid: false,
      detectedType: detectedType || undefined,
      error: detectedType
        ? `File content is ${detectedType}, not ${declaredType}`
        : `File content does not match declared type ${declaredType}`,
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    }
  }
}

/**
 * Detecta el tipo de archivo basado en magic bytes
 */
function detectFileType(bytes: Uint8Array): string | null {
  for (const [type, signatures] of Object.entries(MAGIC_BYTES)) {
    const matches = signatures.every(sig => {
      const offset = sig.offset || 0
      return sig.bytes.every((byte, i) => bytes[offset + i] === byte)
    })
    if (matches) {
      return type
    }
  }
  return null
}

/**
 * Tipos de archivo permitidos
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
export const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]
