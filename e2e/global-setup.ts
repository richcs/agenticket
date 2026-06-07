import { execSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

// Runs once before all tests. Brings up the isolated test database and applies
// migrations to it, so the server-under-test starts against a ready schema.
//
// Note: this file lives outside testMatch (it isn't *.spec.ts), so Playwright
// won't pick it up as a test.
export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, '..');
  const serverDir = path.join(repoRoot, 'server');

  // Load the test DB connection string so prisma migrate targets the test DB,
  // not the dev one. Explicit env vars take precedence over server/.env.
  const testEnv = dotenv.config({ path: path.join(serverDir, '.env.test') }).parsed ?? {};

  // Start the test Postgres container and wait for its healthcheck to pass.
  console.log('[e2e] starting test database (postgres-test)…');
  execSync('docker compose up -d --wait postgres-test', {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  // Apply migrations to the test database.
  console.log('[e2e] applying migrations to test database…');
  execSync('npx prisma migrate deploy', {
    cwd: serverDir,
    stdio: 'inherit',
    env: { ...process.env, ...testEnv },
  });
}
