// Re-export from new auth module for backwards compatibility
// TODO: Update all imports to use '@/lib/auth' directly
export {
  getSession,
  createSession,
  destroySession,
  withAuth,
  withAdmin,
  canAccess,
  canModify,
  type AuthUser,
} from './auth/index'
