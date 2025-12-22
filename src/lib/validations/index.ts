import { z } from 'zod'
import { NextResponse } from 'next/server'
import { MAX_CHARS_PRO, MAX_EMBEDS_PRO } from '@/lib/compose/constants'

// ============================================
// Common Schemas
// ============================================

export const idSchema = z.string().min(1, 'ID is required')

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// ============================================
// Cast Schemas
// ============================================

export const scheduleCastSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  content: z.string().max(MAX_CHARS_PRO, 'Content too long'),
  idempotencyKey: z.string().min(8, 'idempotencyKey is too short').max(128, 'idempotencyKey is too long').optional(),
  scheduledAt: z.string().datetime().optional(),
  channelId: z.string().nullable().optional(),
  parentHash: z.string().nullable().optional(),
  embeds: z.array(z.object({
    url: z.string().url('Invalid embed URL'),
    type: z.enum(['image', 'video']).optional(),
    cloudflareId: z.string().optional(), // ID del video en Cloudflare Stream
    livepeerAssetId: z.string().optional(), // ID del asset en Livepeer
    livepeerPlaybackId: z.string().optional(), // Playback ID de Livepeer
    videoStatus: z.enum(['pending', 'processing', 'ready', 'error']).optional(),
  })).max(MAX_EMBEDS_PRO, 'Maximum embeds exceeded').optional(),
  isDraft: z.boolean().optional(),
}).refine(
  (data) => data.isDraft || (data.content && data.content.trim().length > 0),
  { message: 'Content is required for non-draft casts', path: ['content'] }
).refine(
  (data) => data.isDraft || data.scheduledAt,
  { message: 'scheduledAt is required for scheduled casts', path: ['scheduledAt'] }
)

export const publishCastSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  content: z.string().max(MAX_CHARS_PRO, 'Content too long').optional().default(''),
  idempotencyKey: z.string().min(8, 'idempotencyKey is too short').max(128, 'idempotencyKey is too long').optional(),
  channelId: z.string().nullable().optional(),
  parentHash: z.string().nullable().optional(),
  embeds: z.array(z.object({
    url: z.string().url('Invalid embed URL'),
  })).max(MAX_EMBEDS_PRO, 'Maximum embeds exceeded').optional(),
}).refine(
  (data) => data.content.trim().length > 0 || (data.embeds && data.embeds.length > 0),
  { message: 'content or embeds is required', path: ['content'] }
)

export const scheduleThreadSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  channelId: z.string().nullable().optional(),
  scheduledAt: z.string().datetime(),
  idempotencyKey: z.string().min(8, 'idempotencyKey is too short').max(128, 'idempotencyKey is too long').optional(),
  casts: z.array(z.object({
    content: z
      .string()
      .max(MAX_CHARS_PRO, 'Content too long')
      .refine((v) => v.trim().length > 0, { message: 'content is required' }),
    embeds: z.array(z.object({
      url: z.string().url('Invalid embed URL'),
      type: z.enum(['image', 'video']).optional(),
      cloudflareId: z.string().optional(),
      livepeerAssetId: z.string().optional(),
      livepeerPlaybackId: z.string().optional(),
      videoStatus: z.enum(['pending', 'processing', 'ready', 'error']).optional(),
    })).max(MAX_EMBEDS_PRO, 'Maximum embeds exceeded').optional(),
  })).min(1, 'casts array is required'),
})

export const updateCastSchema = z.object({
  content: z.string().max(MAX_CHARS_PRO).optional(),
  scheduledAt: z.string().datetime().optional(),
  channelId: z.string().nullable().optional(),
  accountId: z.string().optional(),
  embeds: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video']).optional(),
    cloudflareId: z.string().optional(),
    livepeerAssetId: z.string().optional(),
    livepeerPlaybackId: z.string().optional(),
    videoStatus: z.enum(['pending', 'processing', 'ready', 'error']).optional(),
  })).max(MAX_EMBEDS_PRO).optional(),
})

// ============================================
// Template Schemas
// ============================================

export const createTemplateSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  name: z.string().min(1, 'Name is required').max(100),
  content: z.string().min(1, 'Content is required').max(MAX_CHARS_PRO),
  channelId: z.string().nullable().optional(),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(MAX_CHARS_PRO).optional(),
  channelId: z.string().nullable().optional(),
})

// ============================================
// AI Schemas
// ============================================

export const aiReplySchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  originalText: z.string().min(1, 'originalText is required').max(2000, 'originalText too long'),
  authorUsername: z.string().trim().min(1, 'authorUsername is required').max(80, 'authorUsername too long').default('usuario'),
  tone: z.enum(['professional', 'casual', 'friendly', 'witty', 'controversial']).default('friendly'),
  language: z.string().trim().min(2, 'language is required').max(40, 'language too long').default('English'),
  context: z.string().trim().max(500, 'context too long').optional().default(''),
})

// ============================================
// Validation Helper
// ============================================

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: NextResponse }

/**
 * Valida datos con un schema Zod y retorna respuesta de error si falla
 */
export function validate<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): ValidationResult<z.output<S>> {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))

    return {
      success: false,
      error: NextResponse.json(
        { 
          error: 'Validation failed', 
          code: 'VALIDATION_ERROR',
          details: errors 
        },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: result.data }
}

/**
 * Valida query params de URL
 */
export function validateQuery<S extends z.ZodTypeAny>(
  schema: S,
  searchParams: URLSearchParams
): ValidationResult<z.output<S>> {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  return validate(schema, params)
}
