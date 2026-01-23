import { z } from 'zod'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEYNAR_API_KEY: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    NEYNAR_WEBHOOK_SECRET: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL_DEFAULT: z.string().optional(),
    GEMINI_MODEL_PRO: z.string().optional(),
    GEMINI_MODEL_FALLBACK: z.string().optional(),
    GEMINI_MODEL_REPLY: z.string().optional(),
    GEMINI_MODEL_TRANSLATION: z.string().optional(),
    GEMINI_MODEL_BRAND_VALIDATION: z.string().optional(),
    GEMINI_MODEL_ANALYTICS: z.string().optional(),
    GEMINI_MODEL_STYLE_PROFILE: z.string().optional(),
    GEMINI_TIMEOUT_MS: z.coerce.number().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_IMAGES_API_KEY: z.string().optional(),
    CLOUDFLARE_STREAM_DOMAIN: z.string().min(1).default('video.castorapp.xyz'),
    CLOUDFLARE_STREAM_WEBHOOK_SECRET: z.string().optional(),

    LIVEPEER_API_KEY: z.string().optional(),
    FARCASTER_DEVELOPER_MNEMONIC: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_GIPHY_API_KEY: z.string().optional(),
    ALLOWED_FIDS: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return

    if (!val.SESSION_SECRET || val.SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SESSION_SECRET is required in production (min 32 chars)',
        path: ['SESSION_SECRET'],
      })
    }

    if (!val.NEYNAR_API_KEY || val.NEYNAR_API_KEY.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NEYNAR_API_KEY is required in production',
        path: ['NEYNAR_API_KEY'],
      })
    }
  })

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data

const neynarEnvSchema = z.object({
  NEYNAR_API_KEY: z.string().min(1, 'NEYNAR_API_KEY is required'),
})

export function requireNeynarEnv() {
  const parsed = neynarEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Missing Neynar environment variables', parsed.error.flatten().fieldErrors)
    throw new Error('NEYNAR_API_KEY is required')
  }

  return parsed.data
}

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
})

export function requireGeminiEnv() {
  const parsed = geminiEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Missing Gemini environment variables', parsed.error.flatten().fieldErrors)
    throw new Error('GEMINI_API_KEY is required')
  }

  return parsed.data
}

const cloudflareEnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID is required'),
  CLOUDFLARE_IMAGES_API_KEY: z.string().min(1, 'CLOUDFLARE_IMAGES_API_KEY is required'),
  CLOUDFLARE_STREAM_DOMAIN: z.string().min(1).default('video.castorapp.xyz'),
})

export function requireCloudflareEnv() {
  const parsed = cloudflareEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Missing Cloudflare environment variables', parsed.error.flatten().fieldErrors)
    throw new Error('Cloudflare env vars are required')
  }

  return parsed.data
}
