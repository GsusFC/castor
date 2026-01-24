import { db, aiGeneratedCasts, userStyleProfiles } from '../../src/lib/db'
import { neynar } from '../../src/lib/farcaster/client'
import { castorAI } from '../../src/lib/ai/castor-ai'
import { sql, eq, and, lte } from 'drizzle-orm'
import type { UserStyleProfile } from '../../src/lib/ai/castor-ai'

// This is a Netlify scheduled function
export default async (req: Request) => {
  // 1. Obtener casts pendientes que tengan más de 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const castsToAnalyze = await db.query.aiGeneratedCasts.findMany({
    where: and(
      eq(aiGeneratedCasts.status, 'pending_analysis'),
      lte(aiGeneratedCasts.createdAt, twentyFourHoursAgo)
    ),
    limit: 20, // Procesar en lotes para no exceder límites
    with: {
      user: {
        with: {
          styleProfile: true,
        },
      },
    },
  })

  if (castsToAnalyze.length === 0) {
    console.log('[AI Feedback Cron] No casts to analyze.')
    return new Response(JSON.stringify({ message: 'No casts to analyze.' }), { status: 200 })
  }

  console.log(`[AI Feedback Cron] Found ${castsToAnalyze.length} casts to analyze.`)

  for (const cast of castsToAnalyze) {
    if (!cast.user.styleProfile) {
      console.warn(`[AI Feedback Cron] User ${cast.userId} has no style profile. Skipping cast ${cast.castHash}.`)
      await db.update(aiGeneratedCasts).set({ status: 'error' }).where(eq(aiGeneratedCasts.id, cast.id))
      continue
    }

    try {
      // 2. Obtener métricas de Neynar
      const castDetailsResult = await neynar.fetchCast(cast.castHash, {
        type: 'hash',
        viewerFid: cast.user.fid.toString(),
      })

      if (!castDetailsResult?.cast) {
        throw new Error('Cast not found via Neynar')
      }

      const reactions = castDetailsResult.cast.reactions
      const engagementScore =
        (reactions.likes?.length || 0) * 1 +
        (reactions.recasts?.length || 0) * 2 +
        (castDetailsResult.cast.replies?.count || 0) * 3

      // 3. Extraer el tema principal del cast con Gemini
      const topicPrompt = `Extract the single main topic from this text. Respond with only the topic name (1-3 words). Text: "${castDetailsResult.cast.text}"`
      const topic = await castorAI.translate(topicPrompt, 'en') // Using translate as a proxy for a simple generation call

      // 4. Actualizar los insights del perfil de usuario
      const profile = cast.user.styleProfile
      let insights: { topic: string; scores: number[] }[] =
        (profile.engagementInsights as any) || []

      let topicInsight = insights.find(
        (i) => i.topic.toLowerCase() === topic.toLowerCase()
      )

      if (topicInsight) {
        topicInsight.scores.push(engagementScore)
      } else {
        insights.push({ topic, scores: [engagementScore] })
      }

      // 5. Guardar el insight actualizado y marcar el cast como analizado
      await Promise.all([
        db
          .update(userStyleProfiles)
          .set({ engagementInsights: JSON.stringify(insights) })
          .where(eq(userStyleProfiles.userId, cast.userId)),
        db
          .update(aiGeneratedCasts)
          .set({ status: 'analyzed', analyzedAt: new Date() })
          .where(eq(aiGeneratedCasts.id, cast.id)),
      ])

      console.log(`[AI Feedback Cron] Analyzed cast ${cast.castHash}. Topic: ${topic}, Score: ${engagementScore}`)

    } catch (error) {
      console.error(`[AI Feedback Cron] Error analyzing cast ${cast.castHash}:`, error)
      await db.update(aiGeneratedCasts).set({ status: 'error' }).where(eq(aiGeneratedCasts.id, cast.id))
    }
  }

  return new Response(JSON.stringify({ message: `Analyzed ${castsToAnalyze.length} casts.` }), { status: 200 })
}
