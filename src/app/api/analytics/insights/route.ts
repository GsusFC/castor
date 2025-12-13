import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, castAnalytics, analyticsInsightsCache, accountMembers } from '@/lib/db'
import { eq, or, and, desc, inArray, gt } from 'drizzle-orm'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { nanoid } from 'nanoid'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Cache válido por 24 horas
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000

/**
 * GET /api/analytics/insights
 * Obtener insights de AI sobre el rendimiento de los casts
 * Los insights se cachean por 24 horas
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    // Verificar que el usuario tiene acceso a la cuenta
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const hasAccess = session.role === 'admin' || account.ownerId === session.userId || !!membership
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar cache existente (si no se fuerza refresh)
    if (!forceRefresh) {
      const cached = await db.query.analyticsInsightsCache.findFirst({
        where: and(
          eq(analyticsInsightsCache.accountId, accountId),
          gt(analyticsInsightsCache.expiresAt, new Date())
        ),
      })

      if (cached) {
        console.log('[Analytics Insights] Returning cached insights for', accountId)
        return NextResponse.json({
          insights: JSON.parse(cached.insights),
          stats: JSON.parse(cached.stats),
          cached: true,
          generatedAt: cached.generatedAt,
          expiresAt: cached.expiresAt,
        })
      }
    }

    // Obtener últimos 100 casts con métricas
    const casts = await db.query.castAnalytics.findMany({
      where: eq(castAnalytics.accountId, accountId),
      orderBy: [desc(castAnalytics.publishedAt)],
      limit: 100,
    })

    if (casts.length < 5) {
      return NextResponse.json({ 
        error: 'Not enough data',
        message: 'Necesitas al menos 5 casts para generar insights. Usa el botón "Importar" primero.',
      }, { status: 400 })
    }

    // Preparar datos para análisis
    const castsData = casts.map(cast => ({
      content: cast.content?.slice(0, 200) || '',
      likes: cast.likes,
      recasts: cast.recasts,
      replies: cast.replies,
      engagement: cast.likes + cast.recasts + cast.replies,
      hour: new Date(cast.publishedAt).getHours(),
      dayOfWeek: new Date(cast.publishedAt).toLocaleDateString('en-US', { weekday: 'long' }),
      length: cast.content?.length || 0,
    }))

    // Calcular estadísticas básicas
    const avgEngagement = castsData.reduce((sum, c) => sum + c.engagement, 0) / castsData.length
    const topCasts = castsData.filter(c => c.engagement > avgEngagement * 1.5)
    const lowCasts = castsData.filter(c => c.engagement < avgEngagement * 0.5)

    // Análisis por hora
    const byHour: Record<number, { count: number; totalEngagement: number }> = {}
    castsData.forEach(c => {
      if (!byHour[c.hour]) byHour[c.hour] = { count: 0, totalEngagement: 0 }
      byHour[c.hour].count++
      byHour[c.hour].totalEngagement += c.engagement
    })

    // Análisis por día
    const byDay: Record<string, { count: number; totalEngagement: number }> = {}
    castsData.forEach(c => {
      if (!byDay[c.dayOfWeek]) byDay[c.dayOfWeek] = { count: 0, totalEngagement: 0 }
      byDay[c.dayOfWeek].count++
      byDay[c.dayOfWeek].totalEngagement += c.engagement
    })

    const prompt = `Analiza estos datos de rendimiento de posts en Farcaster (red social crypto) y dame insights accionables.

ESTADÍSTICAS:
- Total casts analizados: ${castsData.length}
- Engagement promedio: ${avgEngagement.toFixed(1)} (likes + recasts + replies)
- Casts con alto rendimiento (>1.5x promedio): ${topCasts.length}
- Casts con bajo rendimiento (<0.5x promedio): ${lowCasts.length}

RENDIMIENTO POR HORA (UTC):
${Object.entries(byHour)
  .sort((a, b) => (b[1].totalEngagement / b[1].count) - (a[1].totalEngagement / a[1].count))
  .slice(0, 5)
  .map(([hour, data]) => `- ${hour}:00h: ${data.count} posts, ${(data.totalEngagement / data.count).toFixed(1)} eng/post`)
  .join('\n')}

RENDIMIENTO POR DÍA:
${Object.entries(byDay)
  .sort((a, b) => (b[1].totalEngagement / b[1].count) - (a[1].totalEngagement / a[1].count))
  .map(([day, data]) => `- ${day}: ${data.count} posts, ${(data.totalEngagement / data.count).toFixed(1)} eng/post`)
  .join('\n')}

TOP 5 POSTS (por engagement):
${topCasts.slice(0, 5).map((c, i) => `${i + 1}. "${c.content.slice(0, 100)}..." - ${c.engagement} engagement`).join('\n')}

POSTS CON BAJO RENDIMIENTO (ejemplos):
${lowCasts.slice(0, 3).map((c, i) => `${i + 1}. "${c.content.slice(0, 100)}..." - ${c.engagement} engagement`).join('\n')}

Dame un JSON con este formato exacto (sin markdown):
{
  "bestHours": ["HH:00", "HH:00"],
  "bestDays": ["Day", "Day"],
  "avgEngagement": number,
  "topPerformingTopics": ["topic1", "topic2"],
  "recommendations": [
    "Recomendación específica 1",
    "Recomendación específica 2",
    "Recomendación específica 3"
  ],
  "summary": "Resumen de 1-2 frases sobre el rendimiento general"
}`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const response = await result.response

    const responseText = response.text().trim() || '{}'
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const insights = JSON.parse(cleanJson)

    const stats = {
      totalCasts: castsData.length,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      topPerformers: topCasts.length,
      lowPerformers: lowCasts.length,
    }

    // Guardar en cache
    const now = new Date()
    const expiresAt = new Date(now.getTime() + CACHE_DURATION_MS)

    // Eliminar cache anterior si existe
    await db.delete(analyticsInsightsCache)
      .where(eq(analyticsInsightsCache.accountId, accountId))

    // Insertar nuevo cache
    await db.insert(analyticsInsightsCache).values({
      id: nanoid(),
      accountId,
      insights: JSON.stringify(insights),
      stats: JSON.stringify(stats),
      generatedAt: now,
      expiresAt,
    })

    console.log('[Analytics Insights] Generated and cached insights for', accountId)

    return NextResponse.json({
      insights,
      stats,
      cached: false,
      generatedAt: now,
      expiresAt,
    })
  } catch (error) {
    console.error('[Analytics Insights] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate insights',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
