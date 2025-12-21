import '@testing-library/jest-dom/vitest'

process.env.NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? 'test'
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'castor-test-secret-key-min-32-chars!!'
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'test'
process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID = process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID ?? 'test'
