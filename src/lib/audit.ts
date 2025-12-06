/**
 * Audit logging for critical actions
 * Logs important events for security and debugging
 */

import { logger } from './logger'

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'account.created'
  | 'account.deleted'
  | 'account.shared'
  | 'cast.created'
  | 'cast.published'
  | 'cast.deleted'
  | 'cast.failed'
  | 'signer.created'
  | 'signer.approved'
  | 'media.uploaded'
  | 'template.created'
  | 'template.deleted'

interface AuditLogEntry {
  action: AuditAction
  userId?: string
  accountId?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

/**
 * Log an audit event
 * In production, this could be extended to:
 * - Write to a separate audit table
 * - Send to external logging service (Datadog, etc.)
 * - Emit webhooks for compliance
 */
export function audit(entry: AuditLogEntry): void {
  const timestamp = new Date().toISOString()
  
  logger.info({
    type: 'audit',
    timestamp,
    ...entry,
  }, `[Audit] ${entry.action}`)
}

/**
 * Helper for user actions
 */
export const auditUser = {
  login: (userId: string, ip?: string) => 
    audit({ action: 'user.login', userId, ip }),
  
  logout: (userId: string) => 
    audit({ action: 'user.logout', userId }),
  
  created: (userId: string, metadata?: Record<string, unknown>) => 
    audit({ action: 'user.created', userId, metadata }),
}

/**
 * Helper for account actions
 */
export const auditAccount = {
  created: (userId: string, accountId: string, metadata?: Record<string, unknown>) => 
    audit({ action: 'account.created', userId, accountId, metadata }),
  
  deleted: (userId: string, accountId: string) => 
    audit({ action: 'account.deleted', userId, accountId }),
  
  shared: (userId: string, accountId: string, sharedWithUserId: string) => 
    audit({ action: 'account.shared', userId, accountId, metadata: { sharedWithUserId } }),
}

/**
 * Helper for cast actions
 */
export const auditCast = {
  created: (userId: string, castId: string, accountId: string) => 
    audit({ action: 'cast.created', userId, resourceId: castId, accountId }),
  
  published: (castId: string, accountId: string, castHash?: string) => 
    audit({ action: 'cast.published', resourceId: castId, accountId, metadata: { castHash } }),
  
  deleted: (userId: string, castId: string) => 
    audit({ action: 'cast.deleted', userId, resourceId: castId }),
  
  failed: (castId: string, accountId: string, error: string) => 
    audit({ action: 'cast.failed', resourceId: castId, accountId, metadata: { error } }),
}

/**
 * Helper for signer actions
 */
export const auditSigner = {
  created: (userId: string, accountId: string, signerUuid: string) => 
    audit({ action: 'signer.created', userId, accountId, metadata: { signerUuid } }),
  
  approved: (userId: string, accountId: string, signerUuid: string) => 
    audit({ action: 'signer.approved', userId, accountId, metadata: { signerUuid } }),
}

/**
 * Helper for media actions
 */
export const auditMedia = {
  uploaded: (userId: string, mediaId: string, mediaType: string) => 
    audit({ action: 'media.uploaded', userId, resourceId: mediaId, metadata: { mediaType } }),
}

/**
 * Helper for template actions
 */
export const auditTemplate = {
  created: (userId: string, templateId: string, accountId: string) => 
    audit({ action: 'template.created', userId, resourceId: templateId, accountId }),
  
  deleted: (userId: string, templateId: string) => 
    audit({ action: 'template.deleted', userId, resourceId: templateId }),
}
