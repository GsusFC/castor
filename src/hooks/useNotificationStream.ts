'use client'

import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

interface NotificationEvent {
  type: 'like' | 'recast' | 'reply' | 'mention' | 'follow' | 'connected'
  castHash?: string
  actor?: {
    fid: number
    username: string
    displayName?: string
    pfpUrl?: string
  }
  content?: string
  timestamp?: string
}

interface UseNotificationStreamOptions {
  onNotification?: (notification: NotificationEvent) => void
  showToast?: boolean
}

/**
 * Hook para escuchar notificaciones en tiempo real via SSE
 */
export function useNotificationStream(options: UseNotificationStreamOptions = {}) {
  const { onNotification, showToast = true } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptRef = useRef(0)

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const eventSource = new EventSource('/api/notifications/stream')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data: NotificationEvent = JSON.parse(event.data)
        
        if (data.type === 'connected') {
          reconnectAttemptRef.current = 0
          console.log('[Notifications] Stream connected')
          return
        }

        // Callback personalizado
        onNotification?.(data)

        // Toast de notificación
        if (showToast && data.actor) {
          const messages: Record<string, string> = {
            like: `❤️ @${data.actor.username} te dio like`,
            recast: `🔄 @${data.actor.username} te recasteó`,
            reply: `💬 @${data.actor.username} te respondió`,
            mention: `@ @${data.actor.username} te mencionó`,
            follow: `👤 @${data.actor.username} te sigue`,
          }
          
          toast(messages[data.type] || 'Nueva notificación', {
            description: data.content?.slice(0, 50),
          })
        }
      } catch (error) {
        console.error('[Notifications] Parse error:', error)
      }
    }

    eventSource.onerror = () => {
      if (eventSourceRef.current !== eventSource) return

      eventSource.close()
      eventSourceRef.current = null

      if (reconnectTimeoutRef.current) return

      reconnectAttemptRef.current += 1
      const delayMs = Math.min(5000 * 2 ** (reconnectAttemptRef.current - 1), 60000)

      console.log('[Notifications] Stream error, reconnecting...', { delayMs })

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        connect()
      }, delayMs)
    }
  }, [onNotification, showToast])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connect])

  return {
    reconnect: connect,
  }
}
