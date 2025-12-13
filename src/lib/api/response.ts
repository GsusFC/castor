import { NextResponse } from 'next/server'

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Operations
  OPERATION_FAILED: 'OPERATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // External
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// ============================================
// Response Helpers
// ============================================

interface SuccessResponse<T> {
  success: true
  data: T
}

interface ErrorResponse {
  success: false
  error: string
  code: ErrorCode
  details?: unknown
}

/**
 * Respuesta exitosa
 */
export function success<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Respuesta de error
 */
export function error(
  message: string,
  code: ErrorCode,
  status: number,
  details?: unknown
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    { success: false, error: message, code, details },
    { status }
  )
}

// ============================================
// Common Error Responses
// ============================================

export const ApiErrors = {
  unauthorized: () => 
    error('Authentication required', ErrorCodes.AUTH_REQUIRED, 401),
  
  forbidden: (message = 'Access denied') => 
    error(message, ErrorCodes.FORBIDDEN, 403),

  alreadyExists: (message = 'Already exists') =>
    error(message, ErrorCodes.ALREADY_EXISTS, 409),
  
  notFound: (resource = 'Resource') => 
    error(`${resource} not found`, ErrorCodes.NOT_FOUND, 404),
  
  validationFailed: (details: unknown) => 
    error('Validation failed', ErrorCodes.VALIDATION_ERROR, 400, details),
  
  operationFailed: (message: string, details?: unknown) => 
    error(message, ErrorCodes.OPERATION_FAILED, 500, details),
  
  rateLimited: () => 
    error('Too many requests', ErrorCodes.RATE_LIMITED, 429),
  
  externalError: (service: string, details?: unknown) => 
    error(`${service} API error`, ErrorCodes.EXTERNAL_API_ERROR, 502, details),
}
