import '@testing-library/jest-dom/vitest'

process.env.NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? 'test'
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'castor-test-secret-key-min-32-chars!!'
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'test'

const createStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: createStorage(),
})
