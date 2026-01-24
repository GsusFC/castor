import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'
import { ApiErrors, success } from '@/lib/api/response'

/**
 * GET /api/notifications
 *
 * Endpoint para polling de notificaciones.
 * Retorna las últimas notificaciones no leídas del usuario.
 *
 * Query params:
 * - since: timestamp ISO para obtener solo notificaciones nuevas desde esa fecha
 * - limit: número máximo de notificaciones (default: 20)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.fid) {
    return ApiErrors.unauthorized()
  }

  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  try {
    const conditions = [eq(notifications.recipientFid, session.fid)]

    // Filtrar por fecha si se proporciona
    if (since) {
      const sinceDate = new Date(since)
      if (!isNaN(sinceDate.getTime())) {
        conditions.push(gte(notifications.createdAt, sinceDate))
      }
    }

    const recentNotifications = await db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: [desc(notifications.createdAt)],
      limit: Math.min(limit, 50), // Máximo 50
    })

    // Transformar al formato esperado por el cliente
    const formattedNotifications = recentNotifications.map((notif) => ({
      id: notif.id,
      type: notif.type,
      castHash: notif.castHash || undefined,
      actor: notif.actorFid ? {
        fid: notif.actorFid,
        username: notif.actorUsername || '',
        displayName: notif.actorDisplayName || undefined,
        pfpUrl: notif.actorPfpUrl || undefined,
      } : undefined,
      content: notif.content || undefined,
      timestamp: notif.createdAt.toISOString(),
      read: notif.read,
    }))

    return success({
      notifications: formattedNotifications,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Notifications Polling] Error:', error)
    return ApiErrors.operationFailed('Failed to fetch notifications')
  }
}
