import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Runs once before all tests (and before webServers start).
// Responsibilities:
//   1. Start the isolated test DB container.
//   2. Apply migrations to the test DB.
//   3. Seed known test users (idempotent — safe if the container persisted).
//   4. Clear any cached auth cookie-jar files from previous runs so that
//      worker fixtures re-login against the fresh test DB.
//
// Auth state capture (cookie jars per role) is handled by the worker-scoped
// fixtures in e2e/fixtures/auth.ts, which run after the webServers are up.
export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, '..');
  const serverDir = path.join(repoRoot, 'server');

  // Load the test DB connection string so prisma migrate targets the test DB,
  // not the dev one. Explicit env vars take precedence over server/.env.
  const testEnv = dotenv.config({ path: path.join(serverDir, '.env.test') }).parsed ?? {};
  const mergedEnv = { ...process.env, ...testEnv };

  // ── 0. Clear stale auth cookie-jar files ────────────────────────────────────
  // Sessions are stored in the test DB (which may be ephemeral). Stale cookie
  // files from a previous run would reference deleted session tokens and cause
  // auth fixtures to silently skip re-login, landing on the login page instead
  // of the expected authenticated state.
  const authDir = path.join(repoRoot, 'playwright', '.auth');
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true });
    fs.mkdirSync(authDir, { recursive: true });
    console.log('[e2e] cleared stale auth cookie-jar files.');
  }

  // ── 1. Start test database ──────────────────────────────────────────────────
  console.log('[e2e] starting test database (postgres-test)…');
  execSync('docker compose up -d --wait postgres-test', {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  // ── 2. Apply migrations ─────────────────────────────────────────────────────
  console.log('[e2e] applying migrations to test database…');
  execSync('npx prisma migrate deploy', {
    cwd: serverDir,
    stdio: 'inherit',
    env: mergedEnv,
  });

  // ── 3. Seed test users ──────────────────────────────────────────────────────
  // Uses tsx to run the ESM seeder directly against the test DB.
  // The seeder is idempotent — re-running won't duplicate users.
  // We pass the test env via the `env` option (already merged above) rather
  // than --env-file to avoid cross-platform path quoting issues.
  const seederPath = path.join(__dirname, 'seed-test-users.ts');
  console.log('[e2e] seeding test users…');
  execSync(`npx tsx "${seederPath}"`, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: mergedEnv,
  });

  console.log('[e2e] global setup complete (DB + migrations + seed).');
}
