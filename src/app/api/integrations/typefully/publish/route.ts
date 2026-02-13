import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { db, accounts, accountMembers, typefullySocialSets, scheduledCasts, castMedia } from '@/lib/db'
import { getTypefullyClientForUser, getTypefullyConnectionForUser } from '@/lib/integrations/typefully-store'
import { TypefullyApiError } from '@/lib/integrations/typefully'
import { generateId } from '@/lib/utils'

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
  fallbackToTextOnly: z.boolean().optional(),
})

const platformFromNetwork = (network: 'x' | 'linkedin') => network
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const MB = 1024 * 1024

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

const getMimeFromHeadersOrUrl = (contentTypeHeader: string | null, mediaUrl: string) => {
  const contentType = normalizeMime(contentTypeHeader)
  const urlExt = getExtensionFromUrl(mediaUrl)
  const mime = contentType && MIME_EXTENSION[contentType]
    ? contentType
    : urlExt && EXTENSION_MIME[urlExt]
      ? EXTENSION_MIME[urlExt]
      : null
  const ext = mime ? MIME_EXTENSION[mime] : null
  return { contentType, urlExt, mime, ext }
}

const isImageMime = (mime: string) => mime.startsWith('image/')
const isVideoMime = (mime: string) => mime.startsWith('video/')
const X_MAX_IMAGE_BYTES = 5 * MB

const compressImageForX = async (input: Uint8Array) => {
  const sharp = (await import('sharp')).default
  const source = Buffer.from(input)
  const metadata = await sharp(source, { failOn: 'none' }).metadata()
  const sourceWidth = metadata.width || 0
  const sourceHeight = metadata.height || 0

  for (let attempt = 0; attempt < 6; attempt++) {
    const quality = Math.max(42, 82 - attempt * 8)
    const scale = 1 - attempt * 0.1
    const width =
      sourceWidth > 0 && sourceHeight > 0
        ? Math.max(720, Math.round(sourceWidth * scale))
        : undefined
    const height =
      sourceWidth > 0 && sourceHeight > 0
        ? Math.max(720, Math.round(sourceHeight * scale))
        : undefined

    let pipeline = sharp(source, { failOn: 'none' }).rotate()
    if (width && height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    const output = await pipeline.jpeg({
      quality,
      mozjpeg: true,
      progressive: true,
    }).toBuffer()

    if (output.byteLength <= X_MAX_IMAGE_BYTES) {
      return output
    }
  }

  throw new Error('Could not compress image below X 5MB limit')
}

const validateXMediaConstraints = ({
  mime,
  sizeBytes,
  mediaIndex,
}: {
  mime: string
  sizeBytes: number
  mediaIndex: number
}) => {
  if (mime === 'application/pdf') {
    throw new Error(`X does not support PDF attachments (media #${mediaIndex + 1})`)
  }

  if (mime === 'image/gif' && sizeBytes > 15 * MB) {
    throw new Error(`X GIF exceeds 15MB limit (media #${mediaIndex + 1})`)
  }

  if (isImageMime(mime) && mime !== 'image/gif' && sizeBytes > X_MAX_IMAGE_BYTES) {
    throw new Error(`X image exceeds 5MB limit (media #${mediaIndex + 1})`)
  }

  if (isVideoMime(mime) && sizeBytes > 512 * MB) {
    throw new Error(`X video exceeds 512MB limit (media #${mediaIndex + 1})`)
  }
}

const validatePostLevelConstraints = (
  networks: Network[],
  posts: Array<{ text: string; mediaUrls?: string[] }>
) => {
  if (networks.includes('x')) {
    const overLimitPost = posts.findIndex((post) => (post.mediaUrls || []).filter(Boolean).length > 4)
    if (overLimitPost >= 0) {
      throw new Error(`X supports up to 4 media attachments per post (post #${overLimitPost + 1})`)
    }
  }
}

async function uploadMediaToTypefully(
  socialSetId: number,
  client: NonNullable<Awaited<ReturnType<typeof getTypefullyClientForUser>>>,
  mediaUrls: string[],
  networks: Network[]
) {
  const mediaIds: string[] = []
  const shouldValidateForX = networks.includes('x')

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

    const { contentType, urlExt, mime, ext } = getMimeFromHeadersOrUrl(
      mediaRes.headers.get('content-type'),
      mediaUrl
    )
    if (!ext) {
      throw new Error(
        `Unsupported media type for Typefully (content-type: ${contentType || 'unknown'}, extension: ${urlExt || 'unknown'})`
      )
    }

    let uploadMime = mime || 'application/octet-stream'
    let uploadExt = ext
    const originalBytes = await mediaRes.arrayBuffer()
    let uploadBytes = new Uint8Array(originalBytes)

    if (shouldValidateForX && mime) {
      const isCompressibleImage = isImageMime(mime) && mime !== 'image/gif'
      if (isCompressibleImage && uploadBytes.byteLength > X_MAX_IMAGE_BYTES) {
        try {
          uploadBytes = await compressImageForX(uploadBytes)
          uploadMime = 'image/jpeg'
          uploadExt = 'jpg'
        } catch (compressionError) {
          const compressionMessage =
            compressionError instanceof Error ? compressionError.message : 'unknown compression error'
          throw new Error(`X image exceeds 5MB and compression failed (media #${i + 1}): ${compressionMessage}`)
        }
      }

      validateXMediaConstraints({ mime: uploadMime, sizeBytes: uploadBytes.byteLength, mediaIndex: i })
    }

    const fileName = getFileNameFromUrl(mediaUrl, uploadExt, i)
    const uploadData = await client.createMediaUpload(socialSetId, fileName)
    const putRes = await fetch(uploadData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': uploadMime },
      body: uploadBytes,
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

type Network = 'x' | 'linkedin'

type NetworkPublishResult = {
  network: Network
  status: 'published' | 'degraded' | 'failed'
  draft?: unknown
  usedTextFallback?: boolean
  error?: string
}

const buildBasePlatforms = () =>
  ({
    x: { enabled: false },
    linkedin: { enabled: false },
    mastodon: { enabled: false },
    threads: { enabled: false },
    bluesky: { enabled: false },
  }) as {
    x: { enabled: boolean; posts?: { text: string; media_ids?: string[] }[] }
    linkedin: { enabled: boolean; posts?: { text: string; media_ids?: string[] }[] }
    mastodon: { enabled: boolean }
    threads: { enabled: boolean }
    bluesky: { enabled: boolean }
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

    const { accountId, socialSetId, networks, posts, publishAt, fallbackToTextOnly = true } = parsed.data

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
      // Continue with connected networks and report partial failure per network
      console.warn('[Typefully Publish] Unavailable networks:', unavailable)
    }
    const availableNetworks = networks.filter((network) => !unavailable.includes(network))

    validatePostLevelConstraints(availableNetworks, posts)

    const postsTextOnly = posts.map((post) => ({ text: post.text }))
    const hasAnyMedia = posts.some((post) => (post.mediaUrls || []).filter(Boolean).length > 0)
    let postsWithMedia = postsTextOnly
    let mediaUploadError: string | null = null

    if (hasAnyMedia) {
      try {
        postsWithMedia = await Promise.all(
          posts.map(async (post) => {
            const mediaUrls = (post.mediaUrls || []).filter(Boolean)
            if (mediaUrls.length === 0) return { text: post.text }
            const mediaIds = await uploadMediaToTypefully(
              linkedSocialSet.socialSetId,
              client,
              mediaUrls,
              availableNetworks
            )
            return { text: post.text, media_ids: mediaIds }
          })
        )
      } catch (error) {
        mediaUploadError = error instanceof Error ? error.message : 'Failed media upload to Typefully'
        if (!fallbackToTextOnly) {
          console.error('[Typefully Publish] media upload failed (no fallback):', mediaUploadError)
        } else {
          console.warn('[Typefully Publish] media upload failed; fallback to text-only:', mediaUploadError)
        }
      }
    }

    const results: NetworkPublishResult[] = []

    for (const network of unavailable) {
      results.push({
        network,
        status: 'failed',
        error: 'Network not connected in Typefully social set',
      })
    }

    for (const network of availableNetworks) {
      const primaryPosts = mediaUploadError && fallbackToTextOnly ? postsTextOnly : postsWithMedia
      const primaryUsedTextFallback = Boolean(mediaUploadError && fallbackToTextOnly)
      const primaryPlatforms = buildBasePlatforms()
      if (network === 'x') {
        primaryPlatforms.x = { enabled: true, posts: primaryPosts }
      } else {
        primaryPlatforms.linkedin = { enabled: true, posts: primaryPosts }
      }

      try {
        const draft = await client.createDraft(linkedSocialSet.socialSetId, {
          platforms: primaryPlatforms,
          ...(publishAt ? { publish_at: publishAt } : {}),
        })
        results.push({
          network,
          status: primaryUsedTextFallback ? 'degraded' : 'published',
          draft,
          usedTextFallback: primaryUsedTextFallback,
        })
      } catch (error) {
        const message =
          error instanceof TypefullyApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Typefully draft creation failed'

        // One more rescue path: if media was used in this attempt, retry text-only.
        const canRetryTextOnly =
          fallbackToTextOnly &&
          hasAnyMedia &&
          !primaryUsedTextFallback

        if (canRetryTextOnly) {
          try {
            const retryPlatforms = buildBasePlatforms()
            if (network === 'x') {
              retryPlatforms.x = { enabled: true, posts: postsTextOnly }
            } else {
              retryPlatforms.linkedin = { enabled: true, posts: postsTextOnly }
            }
            const draft = await client.createDraft(linkedSocialSet.socialSetId, {
              platforms: retryPlatforms,
              ...(publishAt ? { publish_at: publishAt } : {}),
            })
            results.push({
              network,
              status: 'degraded',
              draft,
              usedTextFallback: true,
              error: message,
            })
            continue
          } catch (retryError) {
            const retryMessage =
              retryError instanceof TypefullyApiError
                ? retryError.message
                : retryError instanceof Error
                  ? retryError.message
                  : 'Typefully text-only retry failed'
            results.push({
              network,
              status: 'failed',
              error: `${message}. Retry without media failed: ${retryMessage}`,
            })
            continue
          }
        }

        results.push({
          network,
          status: 'failed',
          error: message,
        })
      }
    }

    const successfulResults = results.filter((r) => r.status === 'published' || r.status === 'degraded')
    const publishedCount = results.filter((r) => r.status === 'published').length
    const degradedCount = results.filter((r) => r.status === 'degraded').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    let persistenceError: string | null = null

    if (successfulResults.length > 0) {
      const scheduledAt = publishAt && publishAt !== 'now' ? new Date(publishAt) : new Date()
      const isNow = publishAt === 'now'
      const hasValidScheduledAt = !Number.isNaN(scheduledAt.getTime())
      const content = posts.map((post) => post.text.trim()).filter(Boolean).join('\n\n')
      const fallbackContent = posts.find((post) => post.text.trim())?.text.trim() || 'Published via Typefully'

      try {
        for (const result of successfulResults) {
          const castId = generateId()
          await db.insert(scheduledCasts).values({
            id: castId,
            accountId,
            content: content || fallbackContent,
            scheduledAt: hasValidScheduledAt ? scheduledAt : new Date(),
            publishedAt: isNow ? new Date() : null,
            status: isNow ? 'published' : 'scheduled',
            network: result.network,
            publishTargets: JSON.stringify([result.network]),
            createdById: session.userId,
          })

          const allMediaUrls = posts.flatMap((post) => post.mediaUrls || []).filter(Boolean)
          if (allMediaUrls.length > 0) {
            await db.insert(castMedia).values(
              allMediaUrls.map((url, index) => {
                const isVideo = /\.(mp4|mov|webm|m3u8)$/i.test(url)
                return {
                  id: generateId(),
                  castId,
                  url,
                  type: isVideo ? 'video' as const : 'image' as const,
                  order: index,
                  videoStatus: isVideo ? 'pending' as const : undefined,
                }
              })
            )
          }
        }
      } catch (error) {
        persistenceError =
          error instanceof Error
            ? error.message
            : 'Failed to persist Typefully publish into local Castor storage'
        console.error('[Typefully Publish] Local persistence failed:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        socialSetId: linkedSocialSet.socialSetId,
        requestedNetworks: networks,
        availableNetworks,
        fallbackToTextOnly,
        mediaUploadError,
        persistenceError,
        summary: {
          published: publishedCount,
          degraded: degradedCount,
          failed: failedCount,
        },
        results,
      },
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
