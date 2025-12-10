import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { notificationEmitter, NotificationEvent } from '@/lib/notifications/events'

/**
 * GET /api/notifications/stream
 * Server-Sent Events para notificaciones en tiempo real
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  
  if (!session?.fid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const fid = session.fid

  // Crear stream de SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      // Enviar ping inicial
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))
      
      // Suscribirse a notificaciones
      const unsubscribe = notificationEmitter.subscribe(fid, (notification: NotificationEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(notification)}\n\n`))
        } catch {
          // Stream cerrado
          unsubscribe()
        }
      })
      
      // Heartbeat cada 30s para mantener conexión
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 30000)
      
      // Cleanup cuando se cierra la conexión
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
