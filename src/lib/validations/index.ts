import { z } from 'zod'
import { NextResponse } from 'next/server'

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
  content: z.string().max(1024, 'Content too long'),
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
  })).max(2, 'Maximum 2 embeds allowed').optional(),
  isDraft: z.boolean().optional(),
}).refine(
  (data) => data.isDraft || (data.content && data.content.trim().length > 0),
  { message: 'Content is required for non-draft casts', path: ['content'] }
).refine(
  (data) => data.isDraft || data.scheduledAt,
  { message: 'scheduledAt is required for scheduled casts', path: ['scheduledAt'] }
)

export const updateCastSchema = z.object({
  content: z.string().max(1024).optional(),
  scheduledAt: z.string().datetime().optional(),
  channelId: z.string().nullable().optional(),
  accountId: z.string().optional(),
  embeds: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video']).optional(),
  })).max(2).optional(),
})

// ============================================
// Template Schemas
// ============================================

export const createTemplateSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  name: z.string().min(1, 'Name is required').max(100),
  content: z.string().min(1, 'Content is required').max(1024),
  channelId: z.string().nullable().optional(),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(1024).optional(),
  channelId: z.string().nullable().optional(),
})

// ============================================
// Account Schemas
// ============================================

export const shareAccountSchema = z.object({
  isShared: z.boolean(),
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
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
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
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): ValidationResult<T> {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })
  return validate(schema, params)
}
