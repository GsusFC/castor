import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: {
    command: 'PORT=3002 DATABASE_URL=file:.e2e.db SESSION_SECRET=castor-dev-secret-key-min-32-chars! pnpm dev',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
