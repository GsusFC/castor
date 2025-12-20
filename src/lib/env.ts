import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  NEYNAR_API_KEY: z.string().min(1, 'NEYNAR_API_KEY is required'),
  NEYNAR_WEBHOOK_SECRET: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID is required'),
  CLOUDFLARE_IMAGES_API_KEY: z.string().min(1, 'CLOUDFLARE_IMAGES_API_KEY is required'),
  CLOUDFLARE_STREAM_DOMAIN: z.string().min(1).default('video.castorapp.xyz'),
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: z
    .string()
    .min(1, 'CLOUDFLARE_STREAM_WEBHOOK_SECRET is required'),
  LIVEPEER_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET is required'),
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

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables', parsedEnv.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data
