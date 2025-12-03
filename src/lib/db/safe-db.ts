import { db } from './index'
import { dbLogger, createTimer } from '../logger'
import { retryDatabase } from '../retry'

// ============================================
// Database Error Types
// ============================================

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      'NOT_FOUND'
    )
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string) {
    super(message, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

// ============================================
// Safe Database Operations
// ============================================

/**
 * Executes a database query with logging and error handling
 */
export async function safeQuery<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createTimer()
  
  try {
    const result = await retryDatabase(fn, operation)
    
    dbLogger.debug({
      operation,
      duration: timer.elapsed(),
    }, 'Database query completed')
    
    return result
  } catch (error) {
    dbLogger.error({
      operation,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: timer.elapsed(),
    }, 'Database query failed')
    
    throw new DatabaseError(
      `Database operation failed: ${operation}`,
      'QUERY_FAILED',
      error
    )
  }
}

/**
 * Executes a database transaction with logging and error handling
 */
export async function safeTransaction<T>(
  operation: string,
  fn: Parameters<typeof db.transaction>[0]
): Promise<T> {
  const timer = createTimer()
  
  try {
    const result = await retryDatabase(
      () => db.transaction(fn) as Promise<T>,
      operation
    )
    
    dbLogger.debug({
      operation,
      duration: timer.elapsed(),
    }, 'Database transaction completed')
    
    return result
  } catch (error) {
    dbLogger.error({
      operation,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: timer.elapsed(),
    }, 'Database transaction failed')
    
    throw new DatabaseError(
      `Database transaction failed: ${operation}`,
      'TRANSACTION_FAILED',
      error
    )
  }
}

/**
 * Finds a single record or throws NotFoundError
 */
export async function findOrThrow<T>(
  resource: string,
  fn: () => Promise<T | undefined | null>,
  id?: string
): Promise<T> {
  const result = await safeQuery(`find ${resource}`, fn)
  
  if (!result) {
    throw new NotFoundError(resource, id)
  }
  
  return result
}

/**
 * Checks if a record exists
 */
export async function exists(
  resource: string,
  fn: () => Promise<unknown | undefined | null>
): Promise<boolean> {
  const result = await safeQuery(`check ${resource} exists`, fn)
  return result !== null && result !== undefined
}
