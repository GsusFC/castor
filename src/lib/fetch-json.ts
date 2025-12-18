export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiFailure = {
  success: false
  error: string
  code: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export class ApiRequestError extends Error {
  status: number
  url: string
  code?: string
  details?: unknown
  rawBody?: string

  constructor(args: {
    message: string
    status: number
    url: string
    code?: string
    details?: unknown
    rawBody?: string
  }) {
    super(args.message)
    this.name = 'ApiRequestError'
    this.status = args.status
    this.url = args.url
    this.code = args.code
    this.details = args.details
    this.rawBody = args.rawBody
  }
}

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export const fetchApiData = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, init)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : 'request'

  const rawBody = await res.text()
  const parsed = rawBody.length > 0 ? tryParseJson(rawBody) : null

  if (!parsed || typeof parsed !== 'object') {
    throw new ApiRequestError({
      message: `Invalid JSON response (${res.status})`,
      status: res.status,
      url,
      rawBody: rawBody.slice(0, 500),
    })
  }

  const maybeApi = parsed as Partial<ApiResponse<T>>

  if (maybeApi.success === true) {
    return (maybeApi as ApiSuccess<T>).data
  }

  if (maybeApi.success === false) {
    throw new ApiRequestError({
      message: typeof maybeApi.error === 'string' ? maybeApi.error : `Request failed (${res.status})`,
      status: res.status,
      url,
      code: typeof maybeApi.code === 'string' ? maybeApi.code : undefined,
      details: maybeApi.details,
      rawBody: rawBody.slice(0, 500),
    })
  }

  if (!res.ok) {
    throw new ApiRequestError({
      message: `Request failed (${res.status})`,
      status: res.status,
      url,
      rawBody: rawBody.slice(0, 500),
    })
  }

  return parsed as T
}
