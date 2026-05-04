import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/test/run-next-dev-test.mjs',
    url: 'http://127.0.0.1:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      PORT: '3002',
      NEXT_DIST_DIR: '.next-e2e',
      // Avoid EMFILE (too many open files) by using polling in CI/dev machines with low watcher limits.
      WATCHPACK_POLLING: 'true',
      DATABASE_URL: `file:${path.join(process.cwd(), '.tmp', 'e2e.db')}`,
      DOCUMENTS_DIR: path.join(process.cwd(), '.tmp', 'documents'),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

