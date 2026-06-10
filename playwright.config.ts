import { defineConfig, devices } from '@playwright/test';

// Playwright E2E configuration.
//
// Tests run against an isolated stack so they never touch dev state:
//   - test server  : port 3101, started via `npm run start:e2e -w server`
//                    (uses server/.env.test → postgres-test DB on 5433)
//   - test client  : port 5273, the Vite dev server with CLIENT_PORT /
//                    API_PROXY_TARGET overridden to point at the test server
//   - test database: helpdesk_test in the `postgres-test` container
//
// globalSetup brings up the test DB and runs migrations before the servers
// start. Place test files in ./e2e (e.g. e2e/example.spec.ts).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cap local workers at 4 to reduce auth-fixture startup race (all workers
  // race to capture cookie jars on the first run; too many concurrent bcrypt
  // calls overwhelm the test server). CI uses 1 worker (sequential, no race).
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:5273',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the test server and test client. `reuseExistingServer: false` ensures
  // tests always run against a fresh test stack (never a stray dev server).
  webServer: [
    {
      command: 'npm run start:e2e --workspace server',
      url: 'http://localhost:3101/api/health',
      reuseExistingServer: false,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev --workspace client',
      url: 'http://localhost:5273',
      reuseExistingServer: false,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        CLIENT_PORT: '5273',
        API_PROXY_TARGET: 'http://localhost:3101',
      },
    },
  ],
});
