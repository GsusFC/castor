import { NextRequest } from 'next/server'
import { db, scheduledCasts, accounts, castMedia } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getSession, canAccess } from '@/lib/auth'
import { success, ApiErrors } from '@/lib/api/response'
import { validate, scheduleCastSchema } from '@/lib/validations'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { calculateTextLength } from '@/lib/url-utils'

/**
 * POST /api/casts/schedule
 * Programa un nuevo cast
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(`schedule:${session.userId}`, 'api')
    if (!rateLimit.success) {
      console.warn('[Schedule] Rate limit exceeded:', session.userId)
      return ApiErrors.rateLimited()
    }

    const body = await request.json()
    
    console.log('[Schedule API] Received body:', JSON.stringify(body, null, 2))

    // Validar input con Zod
    const validation = validate(scheduleCastSchema, body)
    if (!validation.success) {
      console.log('[Schedule API] Validation failed:', validation.error)
      return validation.error
    }

    const { accountId, content, scheduledAt, channelId, embeds, isDraft, parentHash } = validation.data
    
    console.log('[Schedule API] Parsed embeds:', embeds)

    // Verificar cuenta
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return ApiErrors.notFound('Account')
    }

    // Verificar permisos
    if (!canAccess(session, { ownerId: account.ownerId, isShared: account.isShared })) {
      return ApiErrors.forbidden('No access to this account')
    }

    // Verificar signer aprobado
    if (account.signerStatus !== 'approved') {
      return ApiErrors.validationFailed([{ 
        field: 'accountId', 
        message: 'Account signer is not approved' 
      }])
    }

    // Validar longitud de contenido usando calculateTextLength (considera URLs)
    const maxChars = account.isPremium ? 1024 : 320
    if (content && calculateTextLength(content) > maxChars) {
      return ApiErrors.validationFailed([{ 
        field: 'content', 
        message: `Content exceeds ${maxChars} characters` 
      }])
    }

    // Validar fecha futura para casts programados
    let scheduledDate: Date | null = null
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt)
      if (!isDraft && scheduledDate <= new Date()) {
        return ApiErrors.validationFailed([{ 
          field: 'scheduledAt', 
          message: 'Scheduled time must be in the future' 
        }])
      }
    }

    // Crear el cast en transacción
    const castId = generateId()
    
    await db.transaction(async (tx) => {
      // Insertar cast
      await tx.insert(scheduledCasts).values({
        id: castId,
        accountId,
        content: (content || '').trim(),
        scheduledAt: scheduledDate || new Date(),
        channelId: channelId || null,
        parentHash: parentHash || null,
        status: isDraft ? 'draft' as const : 'scheduled' as const,
        createdById: session.userId,
      })

      // Insertar media si hay embeds
      if (embeds && embeds.length > 0) {
        const mediaValues = embeds.map((embed, index) => {
          // Determinar tipo: usar el proporcionado o inferir de la URL
          const isVideo = embed.type === 'video' || 
            embed.url.match(/\.(mp4|mov|webm)$/i) ||
            embed.url.includes('cloudflarestream.com')
          
          const mediaRecord: {
            id: string
            castId: string
            url: string
            type: 'image' | 'video'
            order: number
            cloudflareId?: string
            videoStatus?: 'pending' | 'processing' | 'ready' | 'error'
          } = {
            id: generateId(),
            castId,
            url: embed.url,
            type: isVideo ? 'video' : 'image',
            order: index,
          }
          
          // Solo añadir campos de video si tienen valor
          if (embed.cloudflareId) {
            mediaRecord.cloudflareId = embed.cloudflareId
          }
          if (embed.videoStatus) {
            mediaRecord.videoStatus = embed.videoStatus
          }
          
          return mediaRecord
        })
        await tx.insert(castMedia).values(mediaValues)
      }
    })

    console.log('[Schedule] Cast created:', castId)

    return success({ 
      castId,
      status: isDraft ? 'draft' : 'scheduled',
      scheduledAt: scheduledDate?.toISOString(),
    }, 201)

  } catch (error) {
    console.error('[Schedule] Error:', error instanceof Error ? error.message : 'Unknown')
    return ApiErrors.operationFailed('Failed to schedule cast')
  }
}
