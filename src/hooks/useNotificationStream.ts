'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
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

const USE_SSE = process.env.NEXT_PUBLIC_USE_SSE !== 'false' // Default: intentar SSE primero
const POLLING_INTERVAL = 30000 // 30 segundos
const SSE_FAILURE_THRESHOLD = 3 // Cambiar a polling después de 3 fallos rápidos
const FAST_FAILURE_WINDOW = 10000 // 10 segundos

/**
 * Hook para escuchar notificaciones en tiempo real.
 *
 * Estrategia adaptativa:
 * 1. Intenta SSE primero (si está habilitado)
 * 2. Si SSE falla rápidamente múltiples veces → cambia a polling
 * 3. Polling: peticiones cada 30s
 */
export function useNotificationStream(options: UseNotificationStreamOptions = {}) {
  const { onNotification, showToast = true } = options

  // SSE state
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptRef = useRef(0)
  const connectionStartTimeRef = useRef<number>(0)
  const fastFailuresRef = useRef(0)

  // Polling state
  const [usePolling, setUsePolling] = useState(!USE_SSE)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPollTimestampRef = useRef<string | null>(null)

  // Mostrar toast de notificación
  const showNotificationToast = useCallback((data: NotificationEvent) => {
    if (!showToast || !data.actor) return

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
  }, [showToast])

  // Polling: fetch de notificaciones
  const pollNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (lastPollTimestampRef.current) {
        params.set('since', lastPollTimestampRef.current)
      }
      params.set('limit', '20')

      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) {
        console.error('[Notifications Polling] Request failed:', response.status)
        return
      }

      const data = await response.json()
      const { notifications, timestamp } = data

      // Actualizar timestamp para próximo poll
      lastPollTimestampRef.current = timestamp

      // Procesar nuevas notificaciones
      if (notifications && Array.isArray(notifications)) {
        notifications.forEach((notif: NotificationEvent) => {
          onNotification?.(notif)
          showNotificationToast(notif)
        })
      }
    } catch (error) {
      console.error('[Notifications Polling] Error:', error)
    }
  }, [onNotification, showNotificationToast])

  // Iniciar polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    console.log('[Notifications] Using polling mode (interval: 30s)')

    // Poll inmediatamente
    pollNotifications()

    // Luego cada 30s
    pollingIntervalRef.current = setInterval(pollNotifications, POLLING_INTERVAL)
  }, [pollNotifications])

  // Detener polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // SSE: conectar
  const connectSSE = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    connectionStartTimeRef.current = Date.now()
    const eventSource = new EventSource('/api/notifications/stream')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data: NotificationEvent = JSON.parse(event.data)

        if (data.type === 'connected') {
          reconnectAttemptRef.current = 0
          // Solo resetear contador de fallos rápidos si la conexión es estable (> 10s)
          const connectionDuration = Date.now() - connectionStartTimeRef.current
          if (connectionDuration >= FAST_FAILURE_WINDOW) {
            fastFailuresRef.current = 0
          }
          console.log('[Notifications] SSE connected')
          return
        }

        // Callback personalizado
        onNotification?.(data)
        showNotificationToast(data)
      } catch (error) {
        console.error('[Notifications] Parse error:', error)
      }
    }

    eventSource.onerror = () => {
      if (eventSourceRef.current !== eventSource) return

      const connectionDuration = Date.now() - connectionStartTimeRef.current
      const isFastFailure = connectionDuration < FAST_FAILURE_WINDOW

      eventSource.close()
      eventSourceRef.current = null

      // Detectar fallos rápidos
      if (isFastFailure) {
        fastFailuresRef.current += 1
        console.log('[Notifications] SSE fast failure detected', {
          count: fastFailuresRef.current,
          duration: connectionDuration,
        })

        // Cambiar a polling después de múltiples fallos rápidos
        if (fastFailuresRef.current >= SSE_FAILURE_THRESHOLD) {
          console.warn('[Notifications] Too many fast failures, switching to polling')
          setUsePolling(true)
          return
        }
      }

      if (reconnectTimeoutRef.current) return

      reconnectAttemptRef.current += 1
      const delayMs = Math.min(5000 * 2 ** (reconnectAttemptRef.current - 1), 60000)

      console.log('[Notifications] SSE error, reconnecting...', { delayMs })

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        connectSSE()
      }, delayMs)
    }
  }, [onNotification, showNotificationToast])

  // Effect principal
  useEffect(() => {
    if (usePolling) {
      stopPolling() // Limpiar primero
      startPolling()
    } else {
      stopPolling()
      connectSSE()
    }

    return () => {
      // Cleanup SSE
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      // Cleanup polling
      stopPolling()
    }
  }, [usePolling, connectSSE, startPolling, stopPolling])

  return {
    reconnect: usePolling ? pollNotifications : connectSSE,
    mode: usePolling ? 'polling' : 'sse',
  }
}
