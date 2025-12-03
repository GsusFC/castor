import pino from 'pino'

// ============================================
// Logger Configuration
// ============================================

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  
  // En desarrollo, formato legible
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),

  // Redactar campos sensibles
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'signerUuid',
      'mnemonic',
      'apiKey',
      '*.password',
      '*.token',
      '*.signerUuid',
    ],
    censor: '[REDACTED]',
  },

  // Campos base
  base: {
    env: process.env.NODE_ENV,
    service: 'castor',
  },
})

// ============================================
// Child Loggers for Different Modules
// ============================================

export const apiLogger = logger.child({ module: 'api' })
export const authLogger = logger.child({ module: 'auth' })
export const dbLogger = logger.child({ module: 'db' })
export const publisherLogger = logger.child({ module: 'publisher' })
export const farcasterLogger = logger.child({ module: 'farcaster' })

// ============================================
// Request Logger Helper
// ============================================

interface RequestLogContext {
  method: string
  path: string
  userId?: string
  duration?: number
  status?: number
  error?: string
}

export function logRequest(context: RequestLogContext) {
  const { method, path, userId, duration, status, error } = context
  
  const logData = {
    method,
    path,
    userId,
    duration: duration ? `${duration}ms` : undefined,
    status,
  }

  if (error) {
    apiLogger.error({ ...logData, error }, `${method} ${path} failed`)
  } else if (status && status >= 400) {
    apiLogger.warn(logData, `${method} ${path} ${status}`)
  } else {
    apiLogger.info(logData, `${method} ${path} ${status || 'OK'}`)
  }
}

// ============================================
// Performance Timer
// ============================================

export function createTimer() {
  const start = performance.now()
  return {
    elapsed: () => Math.round(performance.now() - start),
  }
}
