import { requireTypefullyEnv } from '@/lib/env'

export interface TypefullyUser {
  id: number
  name: string
  email: string
  signup_date: string
  api_key_label: string | null
  profile_image_url: string | null
}

export interface TypefullyTeamRef {
  id: string
  name: string
}

export interface TypefullySocialSet {
  id: number
  username: string
  name: string
  profile_image_url: string
  team: TypefullyTeamRef | null
}

export interface TypefullyPaginated<T> {
  results: T[]
  count: number
  limit: number
  offset: number
  next: string | null
  previous: string | null
}

export interface TypefullyPlatformAccount {
  platform: 'x' | 'linkedin' | 'mastodon' | 'threads' | 'bluesky'
  username?: string | null
  profile_url?: string | null
  name?: string | null
  profile_image_url?: string | null
}

export interface TypefullySocialSetDetail extends TypefullySocialSet {
  platforms: {
    x: TypefullyPlatformAccount
    linkedin: TypefullyPlatformAccount
    mastodon: TypefullyPlatformAccount
    threads: TypefullyPlatformAccount
    bluesky: TypefullyPlatformAccount
  }
}

interface TypefullyDraftPost {
  text: string
}

interface TypefullyDraftPlatformConfig {
  enabled: boolean
  posts?: TypefullyDraftPost[]
  settings?: Record<string, unknown>
}

export interface TypefullyCreateDraftRequest {
  platforms: {
    x?: TypefullyDraftPlatformConfig
    linkedin?: TypefullyDraftPlatformConfig
    mastodon?: TypefullyDraftPlatformConfig
    threads?: TypefullyDraftPlatformConfig
    bluesky?: TypefullyDraftPlatformConfig
  }
  publish_at?: string
  draft_title?: string
}

interface TypefullyErrorDetail {
  message?: string
  field?: string
  type?: string
}

interface TypefullyErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: TypefullyErrorDetail[]
  }
}

export class TypefullyApiError extends Error {
  status: number
  code?: string
  details?: TypefullyErrorDetail[]

  constructor(message: string, status: number, code?: string, details?: TypefullyErrorDetail[]) {
    super(message)
    this.name = 'TypefullyApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const parseJsonSafe = (value: string) => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export class TypefullyClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    if (config?.apiKey) {
      this.apiKey = config.apiKey
      this.baseUrl = config.baseUrl || 'https://api.typefully.com'
      return
    }

    const env = requireTypefullyEnv()
    this.apiKey = env.TYPEFULLY_API_KEY
    this.baseUrl = env.TYPEFULLY_BASE_URL || 'https://api.typefully.com'
  }

  async getMe(): Promise<TypefullyUser> {
    return this.request<TypefullyUser>('/v2/me')
  }

  async listSocialSets(limit = 10, offset = 0): Promise<TypefullyPaginated<TypefullySocialSet>> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })
    return this.request<TypefullyPaginated<TypefullySocialSet>>(`/v2/social-sets?${params.toString()}`)
  }

  async getSocialSet(socialSetId: number): Promise<TypefullySocialSetDetail> {
    return this.request<TypefullySocialSetDetail>(`/v2/social-sets/${socialSetId}/`)
  }

  async createDraft(socialSetId: number, payload: TypefullyCreateDraftRequest) {
    return this.request(`/v2/social-sets/${socialSetId}/drafts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = new URL(path, this.baseUrl)
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    })

    const raw = await res.text()
    const parsed = raw ? parseJsonSafe(raw) : null

    if (!res.ok) {
      const errorEnvelope = (parsed || {}) as TypefullyErrorEnvelope
      throw new TypefullyApiError(
        errorEnvelope.error?.message || `Typefully request failed (${res.status})`,
        res.status,
        errorEnvelope.error?.code,
        errorEnvelope.error?.details
      )
    }

    if (!parsed) {
      throw new TypefullyApiError('Typefully response is not valid JSON', res.status)
    }

    return parsed as T
  }
}
