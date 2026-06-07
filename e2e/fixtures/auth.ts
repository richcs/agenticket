// Playwright fixtures for authentication.
//
// Provides two fixtures:
//   - `adminPage`  — a Page already signed in as the admin user
//   - `agentPage`  — a Page already signed in as the agent user
//
// The cookie jar (storageState) is captured once per worker and reused for
// every test in that worker, matching Playwright's recommended pattern for
// multi-role auth testing. The login UI is exercised only on first use;
// subsequent tests reuse the saved session cookies.

import { type BrowserContext, type Page, test as baseTest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN, AGENT, type Credentials } from './credentials.js';

type AuthFixtures = {
  adminPage: Page;
  agentPage: Page;
};

type WorkerAuthFixtures = {
  adminStorageState: string;
  agentStorageState: string;
};

// Resolves the auth file path unique per worker/role so parallel workers
// don't trample each other's cookie jars.
function authFilePath(role: string, parallelIndex: number): string {
  const dir = path.resolve('playwright', '.auth');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${role}-${parallelIndex}.json`);
}

// Logs in via the real UI and saves the session cookie jar to `filePath`.
async function loginAndSave(
  context: BrowserContext,
  creds: Credentials,
  filePath: string,
): Promise<void> {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for redirect to home — confirms the session cookie was set.
  await page.waitForURL('/');
  await context.storageState({ path: filePath });
  await page.close();
}

export const test = baseTest.extend<AuthFixtures, WorkerAuthFixtures>({
  // ── Worker-scoped: log in once, reuse the cookie jar across all tests
  //    in this worker for the same role. ─────────────────────────────────────

  adminStorageState: [
    async ({ browser }, use, workerInfo) => {
      const filePath = authFilePath('admin', workerInfo.parallelIndex);
      if (!fs.existsSync(filePath)) {
        const context = await browser.newContext({ storageState: undefined });
        await loginAndSave(context, ADMIN, filePath);
        await context.close();
      }
      await use(filePath);
    },
    { scope: 'worker' },
  ],

  agentStorageState: [
    async ({ browser }, use, workerInfo) => {
      const filePath = authFilePath('agent', workerInfo.parallelIndex);
      if (!fs.existsSync(filePath)) {
        const context = await browser.newContext({ storageState: undefined });
        await loginAndSave(context, AGENT, filePath);
        await context.close();
      }
      await use(filePath);
    },
    { scope: 'worker' },
  ],

  // ── Test-scoped: a fresh Page that starts with the role's cookies ──────────

  adminPage: async ({ browser, adminStorageState }, use) => {
    const context = await browser.newContext({ storageState: adminStorageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  agentPage: async ({ browser, agentStorageState }, use) => {
    const context = await browser.newContext({ storageState: agentStorageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
