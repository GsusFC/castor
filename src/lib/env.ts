import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEYNAR_API_KEY: z.string().min(1, 'NEYNAR_API_KEY is required'),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET is required'),
  NEYNAR_WEBHOOK_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
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
  NEXT_PUBLIC_NEYNAR_CLIENT_ID: z.string().min(1, 'NEXT_PUBLIC_NEYNAR_CLIENT_ID is required'),
  NEXT_PUBLIC_GIPHY_API_KEY: z.string().optional(),
  ALLOWED_FIDS: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data

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
