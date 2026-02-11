import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, userStyleProfiles } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { requireGeminiEnv } from '@/lib/env'
import { neynar } from '@/lib/farcaster/client'
import { GEMINI_MODELS } from '@/lib/ai/gemini-config'
import { generateGeminiText } from '@/lib/ai/gemini-helpers'
const CASTS_PER_PAGE = 100
const MAX_PAGES = 10 // 1000 casts total
const BATCH_SIZE = 100 // casts por batch para análisis

interface RouteContext {
  params: Promise<{ id: string }>
}

// Función para obtener casts paginados de Neynar
async function fetchAllCasts(fid: number, maxCasts: number = 1000): Promise<string[]> {
  const allCasts: string[] = []
  let cursor: string | undefined = undefined
  let pages = 0

  while (allCasts.length < maxCasts && pages < MAX_PAGES) {
    console.log(`[Style Profile] Fetching page ${pages + 1} with cursor: ${cursor || 'start'}`)

    try {
      const response = await neynar.fetchFeed({
        feedType: 'filter',
        filterType: 'fids',
        fids: fid.toString(),
        limit: CASTS_PER_PAGE,
        cursor,
        withRecasts: true,
      })

      const casts = response.casts || []

      for (const cast of casts) {
        if (cast.text && cast.text.length > 10) {
          allCasts.push(cast.text)
        }
      }

      cursor = response.next?.cursor || undefined
      pages++

      if (!cursor || casts.length === 0) break
    } catch (error) {
      console.error('[Style Profile] Neynar error on page', pages + 1, error)
      break
    }
  }

  console.log(`[Style Profile] Total casts fetched: ${allCasts.length}`)
  return allCasts
}

// Función para analizar un batch de casts
async function analyzeBatch(casts: string[], batchNum: number): Promise<string> {
  const prompt = `Analiza estos ${casts.length} posts de redes sociales (batch ${batchNum}). Resume en 2-3 oraciones:
- Tono predominante
- Temas principales
- Estilo de escritura
- Uso de emojis
- Idioma

Posts:
${casts.slice(0, 50).map((t, i) => `${i + 1}. "${t.substring(0, 200)}"`).join('\n')}

Responde en español, máximo 100 palabras.`

  try {
    return await generateGeminiText({
      modelId: GEMINI_MODELS.styleProfile,
      fallbackModelId: GEMINI_MODELS.fallback,
      prompt,
    })
  } catch (error) {
    console.error(`[Style Profile] Error analyzing batch ${batchNum}:`, error)
    return ''
  }
}

// Función para sintetizar todos los análisis en Voz Personal completa
async function synthesizePersonalVoice(batchAnalyses: string[], totalCasts: number): Promise<{
  personalVoice: string
  tone: string
  topics: string[]
  emojiUsage: string
  languagePreference: string
  avgLength: number
  alwaysDo: string[]
  neverDo: string[]
  hashtags: string[]
}> {
  const prompt = `Basándote en el análisis de ${totalCasts} publicaciones, genera un perfil de "Voz Personal" completo para este usuario.

Análisis parciales:
${batchAnalyses.map((a, i) => `Batch ${i + 1}: ${a}`).join('\n\n')}

Analiza los patrones y genera reglas de estilo. Responde SOLO con JSON válido (sin markdown):
{
  "personalVoice": "<descripción detallada de 150-250 palabras: personalidad, estilo único, cómo se comunica, qué tono usa, patrones distintivos>",
  "tone": "casual|formal|technical|humorous|mixed",
  "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"],
  "emojiUsage": "none|light|heavy",
  "languagePreference": "en|es|mixed",
  "avgLength": <número estimado>,
  "alwaysDo": [
    "<regla 1: algo que SIEMPRE hace en sus posts>",
    "<regla 2>",
    "<regla 3>",
    "<regla 4>",
    "<regla 5>"
  ],
  "neverDo": [
    "<regla 1: algo que NUNCA hace en sus posts>",
    "<regla 2>",
    "<regla 3>",
    "<regla 4>",
    "<regla 5>"
  ],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
}`

  const responseText = await generateGeminiText({
    modelId: GEMINI_MODELS.styleProfile,
    fallbackModelId: GEMINI_MODELS.fallback,
    prompt,
  })

  const text = responseText
    .trim()
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  const parsed = JSON.parse(text) as {
    personalVoice?: string
    brandVoice?: string
    tone?: string
    topics?: string[]
    emojiUsage?: string
    languagePreference?: string
    avgLength?: number
    alwaysDo?: string[]
    neverDo?: string[]
    hashtags?: string[]
  }

  return {
    personalVoice: parsed.personalVoice || parsed.brandVoice || '',
    tone: parsed.tone || 'casual',
    topics: parsed.topics || [],
    emojiUsage: parsed.emojiUsage || 'light',
    languagePreference: parsed.languagePreference || 'en',
    avgLength: parsed.avgLength || 150,
    alwaysDo: parsed.alwaysDo || [],
    neverDo: parsed.neverDo || [],
    hashtags: parsed.hashtags || [],
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    requireGeminiEnv()

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!account.ownerId) {
      return NextResponse.json({ error: 'Account owner not found' }, { status: 400 })
    }

    const isOwner = account.ownerId === session.userId
    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
    })

    if (session.role !== 'admin' && !isOwner && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Obtener hasta 1000 casts
    console.log('[Style Profile] Starting analysis for fid:', account.fid)
    const allCasts = await fetchAllCasts(account.fid, 1000)

    if (allCasts.length < 5) {
      return NextResponse.json({
        error: 'Not enough casts to analyze. Need at least 5 casts.',
        castsFound: allCasts.length
      }, { status: 400 })
    }

    // 2. Analizar por batches
    const batchAnalyses: string[] = []
    const numBatches = Math.ceil(allCasts.length / BATCH_SIZE)

    console.log(`[Style Profile] Analyzing ${numBatches} batches...`)

    for (let i = 0; i < Math.min(numBatches, 10); i++) {
      const batchCasts = allCasts.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      const analysis = await analyzeBatch(batchCasts, i + 1)
      if (analysis) {
        batchAnalyses.push(analysis)
      }
      // Pequeña pausa para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 3. Sintetizar voz personal final
    console.log('[Style Profile] Synthesizing personal voice...')
    const personalVoiceData = await synthesizePersonalVoice(batchAnalyses, allCasts.length)

    // 4. Guardar en DB
    const existingProfile = await db.query.userStyleProfiles.findFirst({
      where: eq(userStyleProfiles.userId, account.ownerId),
    })

    const now = new Date()
    const validTones = ['casual', 'formal', 'technical', 'humorous', 'mixed'] as const
    const validEmoji = ['none', 'light', 'heavy'] as const
    const validLang = ['en', 'es', 'mixed'] as const

    const tone = validTones.includes(personalVoiceData.tone as typeof validTones[number])
      ? personalVoiceData.tone as typeof validTones[number]
      : 'casual'
    const emojiUsage = validEmoji.includes(personalVoiceData.emojiUsage as typeof validEmoji[number])
      ? personalVoiceData.emojiUsage as typeof validEmoji[number]
      : 'light'
    const languagePreference = validLang.includes(personalVoiceData.languagePreference as typeof validLang[number])
      ? personalVoiceData.languagePreference as typeof validLang[number]
      : 'en'

    const profileData = {
      fid: account.fid,
      tone,
      avgLength: personalVoiceData.avgLength || 150,
      commonPhrases: JSON.stringify([personalVoiceData.personalVoice]),
      topics: JSON.stringify(personalVoiceData.topics || []),
      emojiUsage,
      languagePreference,
      sampleCasts: JSON.stringify(allCasts.slice(0, 10)),
      analyzedAt: now,
      updatedAt: now,
    }

    let profile
    if (existingProfile) {
      await db
        .update(userStyleProfiles)
        .set(profileData)
        .where(eq(userStyleProfiles.id, existingProfile.id))

      profile = { ...existingProfile, ...profileData }
    } else {
      const profileId = nanoid()
      await db
        .insert(userStyleProfiles)
        .values({
          id: profileId,
          userId: account.ownerId,
          ...profileData,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: userStyleProfiles.userId,
          set: profileData,
        })

      const savedProfile = await db.query.userStyleProfiles.findFirst({
        where: eq(userStyleProfiles.userId, account.ownerId),
      })

      if (!savedProfile) {
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
      }

      profile = savedProfile
    }

    console.log(`[Style Profile] Done! Analyzed ${allCasts.length} casts`)

    return NextResponse.json({
      success: true,
      profile,
      castsAnalyzed: allCasts.length,
      personalVoice: personalVoiceData.personalVoice,
      brandVoice: personalVoiceData.personalVoice, // Legacy compatibility for existing clients
      alwaysDo: personalVoiceData.alwaysDo || [],
      neverDo: personalVoiceData.neverDo || [],
      hashtags: personalVoiceData.hashtags || []
    })
  } catch (error) {
    console.error('Error generating style profile:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 })
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: accountId } = await context.params

    // Verificar que la cuenta existe
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (!account.ownerId) {
      return NextResponse.json({ error: 'Account owner not found' }, { status: 400 })
    }

    const isOwner = account.ownerId === session.userId

    const membership = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, session.userId)
      ),
      columns: {
        id: true,
      },
    })

    if (session.role !== 'admin' && !isOwner && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const profile = await db.query.userStyleProfiles.findFirst({
      where: eq(userStyleProfiles.userId, account.ownerId),
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error getting style profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
