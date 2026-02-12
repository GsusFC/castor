import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, typefullySocialSets } from '@/lib/db'
import { getTypefullyClientForUser, getTypefullyConnectionForUser } from '@/lib/integrations/typefully-store'
import { TypefullyApiError } from '@/lib/integrations/typefully'

const bodySchema = z.object({
  accountId: z.string().min(1),
  socialSetId: z.number().int().positive().optional(),
  networks: z.array(z.enum(['x', 'linkedin'])).min(1),
  posts: z.array(
    z.object({
      text: z.string().min(1),
      mediaUrls: z.array(z.string().url()).optional(),
    })
  ).min(1),
  publishAt: z.union([z.literal('now'), z.string().datetime()]).optional(),
})

const platformFromNetwork = (network: 'x' | 'linkedin') => network
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const MIME_EXTENSION: Record<string, string> = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
}

const normalizeMime = (value: string | null) => value?.split(';')[0].trim().toLowerCase() || null

const getExtensionFromUrl = (url: string): string | null => {
  try {
    const pathname = new URL(url).pathname
    const candidate = pathname.split('/').pop() || ''
    const extension = candidate.includes('.') ? candidate.split('.').pop() : null
    return extension?.toLowerCase() || null
  } catch {
    return null
  }
}

const getFileNameFromUrl = (url: string, fallbackExt: string, index: number) => {
  try {
    const pathname = new URL(url).pathname
    const candidate = pathname.split('/').pop() || ''
    if (candidate.includes('.')) return candidate
  } catch {
    // ignore parse errors and use fallback
  }
  return `media-${Date.now()}-${index}.${fallbackExt}`
}

async function uploadMediaToTypefully(
  socialSetId: number,
  client: NonNullable<Awaited<ReturnType<typeof getTypefullyClientForUser>>>,
  mediaUrls: string[]
) {
  const mediaIds: string[] = []

  for (let i = 0; i < mediaUrls.length; i++) {
    const mediaUrl = mediaUrls[i]
    const mediaRes = await fetch(mediaUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf,*/*;q=0.8',
      },
    })
    if (!mediaRes.ok) {
      throw new Error(`Could not read attached media (${mediaRes.status}) from URL #${i + 1}`)
    }

    const contentType = normalizeMime(mediaRes.headers.get('content-type'))
    const urlExt = getExtensionFromUrl(mediaUrl)
    const mime = contentType && MIME_EXTENSION[contentType]
      ? contentType
      : urlExt && EXTENSION_MIME[urlExt]
        ? EXTENSION_MIME[urlExt]
        : null
    const ext = mime ? MIME_EXTENSION[mime] : null
    if (!ext) {
      throw new Error(
        `Unsupported media type for Typefully (content-type: ${contentType || 'unknown'}, extension: ${urlExt || 'unknown'})`
      )
    }

    const fileName = getFileNameFromUrl(mediaUrl, ext, i)
    const uploadData = await client.createMediaUpload(socialSetId, fileName)
    const bytes = await mediaRes.arrayBuffer()
    const putRes = await fetch(uploadData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': mime || 'application/octet-stream' },
      body: bytes,
    })

    if (!putRes.ok) {
      throw new Error(`Failed to upload media to Typefully storage (${putRes.status})`)
    }

    let status = await client.getMediaStatus(socialSetId, uploadData.media_id)
    for (let attempt = 0; attempt < 20 && status.status === 'processing'; attempt++) {
      await sleep(1500)
      status = await client.getMediaStatus(socialSetId, uploadData.media_id)
    }

    if (status.status !== 'ready') {
      throw new Error(status.error_reason || 'Typefully media processing did not complete')
    }

    mediaIds.push(uploadData.media_id)
  }

  return mediaIds
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const { accountId, socialSetId, networks, posts, publishAt } = parsed.data

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { id: true, ownerId: true },
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const membership = await db.query.accountMembers.findFirst({
      where: and(eq(accountMembers.accountId, accountId), eq(accountMembers.userId, session.userId)),
      columns: { id: true },
    })

    if (account.ownerId !== session.userId && !membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const connection = await getTypefullyConnectionForUser(session.userId)
    if (!connection) {
      return NextResponse.json({ error: 'Typefully is not connected' }, { status: 400 })
    }

    const linkedSocialSet = socialSetId
      ? await db.query.typefullySocialSets.findFirst({
          where: and(
            eq(typefullySocialSets.connectionId, connection.id),
            eq(typefullySocialSets.socialSetId, socialSetId)
          ),
        })
      : await db.query.typefullySocialSets.findFirst({
          where: and(
            eq(typefullySocialSets.connectionId, connection.id),
            eq(typefullySocialSets.linkedAccountId, accountId)
          ),
        })

    if (!linkedSocialSet) {
      return NextResponse.json(
        { error: 'No Typefully social set linked to this Castor account' },
        { status: 400 }
      )
    }

    const client = await getTypefullyClientForUser(session.userId)
    if (!client) {
      return NextResponse.json({ error: 'Typefully connection unavailable' }, { status: 500 })
    }

    const detail = await client.getSocialSet(linkedSocialSet.socialSetId)
    const hasValue = (value: string | null | undefined) => Boolean(value?.trim())
    const unavailable = networks.filter((network) => {
      const platform = detail.platforms[platformFromNetwork(network)]
      return !(
        hasValue(platform?.username) ||
        hasValue(platform?.profile_url) ||
        hasValue(platform?.name) ||
        hasValue(platform?.profile_image_url)
      )
    })
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `Networks not connected in Typefully: ${unavailable.join(', ')}` },
        { status: 400 }
      )
    }

    const postsWithMedia = await Promise.all(
      posts.map(async (post) => {
        const mediaUrls = (post.mediaUrls || []).filter(Boolean)
        if (mediaUrls.length === 0) return { text: post.text }
        const mediaIds = await uploadMediaToTypefully(linkedSocialSet.socialSetId, client, mediaUrls)
        return { text: post.text, media_ids: mediaIds }
      })
    )

    const platforms = {
      x: { enabled: false },
      linkedin: { enabled: false },
      mastodon: { enabled: false },
      threads: { enabled: false },
      bluesky: { enabled: false },
    } as {
      x: { enabled: boolean; posts?: { text: string; media_ids?: string[] }[] }
      linkedin: { enabled: boolean; posts?: { text: string; media_ids?: string[] }[] }
      mastodon: { enabled: boolean }
      threads: { enabled: boolean }
      bluesky: { enabled: boolean }
    }

    if (networks.includes('x')) {
      platforms.x = { enabled: true, posts: postsWithMedia }
    }
    if (networks.includes('linkedin')) {
      platforms.linkedin = { enabled: true, posts: postsWithMedia }
    }

    const draft = await client.createDraft(linkedSocialSet.socialSetId, {
      platforms,
      ...(publishAt ? { publish_at: publishAt } : {}),
    })

    return NextResponse.json({
      success: true,
      socialSetId: linkedSocialSet.socialSetId,
      networks,
      draft,
    })
  } catch (error) {
    if (error instanceof TypefullyApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      )
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('[Typefully Publish] POST error:', error)
    return NextResponse.json({ error: 'Failed to publish via Typefully' }, { status: 500 })
  }
}
