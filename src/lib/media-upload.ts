import { fetchApiData } from '@/lib/fetch-json'

export type MediaUploadType = 'image' | 'video'

type UploadUrlData = {
  type: MediaUploadType
  uploadUrl: string
  id: string
  cloudflareId?: string
}

export type ConfirmImageData = {
  url: string
  type: 'image'
  id: string
}

export type ConfirmVideoData = {
  url: string
  type: 'video'
  id: string
  cloudflareId?: string
  videoStatus?: 'pending' | 'processing' | 'ready' | 'error'
  hlsUrl?: string
  mp4Url?: string
  watchUrl?: string
  thumbnailUrl?: string
  width?: number | null
  height?: number | null
}

export type ConfirmMediaData = ConfirmImageData | ConfirmVideoData

export type UploadMediaResult = ConfirmMediaData & {
  cloudflareId: string
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required`)
  }
}

export const requestUploadUrl = async (file: File): Promise<{ type: MediaUploadType; uploadUrl: string; cloudflareId: string }> => {
  const data = await fetchApiData<UploadUrlData>('/api/media/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }),
  })

  assertNonEmptyString(data.uploadUrl, 'uploadUrl')
  assertNonEmptyString(data.id, 'id')

  const cloudflareId = typeof data.cloudflareId === 'string' && data.cloudflareId.trim().length > 0 ? data.cloudflareId : data.id
  assertNonEmptyString(cloudflareId, 'cloudflareId')

  return {
    type: data.type,
    uploadUrl: data.uploadUrl,
    cloudflareId,
  }
}

export const confirmMediaUpload = async (args: {
  cloudflareId: string
  type: MediaUploadType
}): Promise<ConfirmMediaData> => {
  const { cloudflareId, type } = args
  assertNonEmptyString(cloudflareId, 'cloudflareId')

  return fetchApiData<ConfirmMediaData>('/api/media/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cloudflareId, type }),
  })
}

export const uploadToDirectUrl = async (args: {
  uploadUrl: string
  file: File
}): Promise<void> => {
  const { uploadUrl, file } = args
  assertNonEmptyString(uploadUrl, 'uploadUrl')

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(uploadUrl, { method: 'POST', body: formData })
  if (res.ok) return

  const errorText = await res.text().catch(() => '')
  throw new Error(`Direct upload failed (${res.status})${errorText ? `: ${errorText.slice(0, 200)}` : ''}`)
}

export const uploadMedia = async (file: File): Promise<UploadMediaResult> => {
  const { type, uploadUrl, cloudflareId } = await requestUploadUrl(file)
  await uploadToDirectUrl({ uploadUrl, file })
  const confirmed = await confirmMediaUpload({ cloudflareId, type })

  return {
    ...confirmed,
    cloudflareId,
  }
}
