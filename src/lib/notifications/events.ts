import { EventEmitter } from 'events'

/**
 * Sistema de eventos para notificaciones en tiempo real
 * En producción, esto debería ser Redis Pub/Sub
 */
class NotificationEmitter extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100) // Permitir múltiples conexiones
  }

  /**
   * Emitir notificación a un usuario específico
   */
  notify(fid: number, notification: NotificationEvent) {
    this.emit(`user:${fid}`, notification)
  }

  /**
   * Suscribirse a notificaciones de un usuario
   */
  subscribe(fid: number, callback: (notification: NotificationEvent) => void) {
    this.on(`user:${fid}`, callback)
    return () => this.off(`user:${fid}`, callback)
  }
}

export interface NotificationEvent {
  type: 'like' | 'recast' | 'reply' | 'mention' | 'follow'
  castHash?: string
  actor: {
    fid: number
    username: string
    displayName?: string
    pfpUrl?: string
  }
  content?: string
  timestamp: string
}

// Singleton
export const notificationEmitter = new NotificationEmitter()
