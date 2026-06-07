---
name: infra-setup
description: Playwright test infrastructure layout, ports, DB, startup order, and key gotchas discovered during auth test development
metadata:
  type: project
---

## Startup order (critical)

Playwright starts `webServer` entries BEFORE `globalSetup` runs. This means:
- `globalSetup` cannot do browser-based login (servers aren't up yet)
- Auth cookie-jar capture must happen in worker-scoped fixtures (run after servers start)
- `globalSetup` is for: DB container start, migrations, user seeding, and clearing stale cookie-jar files

## Ports

- Test server: 3101 (`npm run start:e2e --workspace server` → `tsx --env-file=.env.test`)
- Test client: 5273 (`npm run dev --workspace client` with `CLIENT_PORT=5273`, `API_PROXY_TARGET=http://localhost:3101`)
- Test DB: postgres-test container, port 5433, `helpdesk_test` database
- baseURL: `http://localhost:5273`

## Cookie-jar stale cache (key gotcha)

The test DB (postgres-test) uses `tmpfs` — sessions are lost when container restarts.
Worker-scoped fixtures save cookie-jars to `playwright/.auth/<role>-<workerIndex>.json`.
If these files persist from a previous run, the fixture skips re-login but the session
token is no longer in the DB → auth silently fails → test lands on /login instead of
the expected page.

**Fix applied**: `globalSetup` deletes and recreates `playwright/.auth/` at the start of
every run. This forces all workers to re-login against the fresh DB.

## Seeder (e2e/seed-test-users.ts)

- Run via `npx tsx` with `env: mergedEnv` (not `--env-file`) to avoid Windows path quoting issues
- Uses async IIFE (no top-level await) because the e2e/ directory has no `"type":"module"` package.json and tsx defaults to CJS for it — top-level await fails in CJS mode
- Idempotent: skips users that already exist, promotes role if wrong

## Better Auth endpoints

- Sign-in: `POST /api/auth/sign-in/email`
- Session check: `GET /api/auth/get-session` (this is what `useSession()` calls)
- Auth mounted at `/api/auth/*splat` in Express

## Scripts

- `npm run test:e2e` — full suite (DB → migrate → seed → servers → tests)
- `npm run test:e2e:ui` — interactive UI mode
- `npm run test:e2e:report` — open last HTML report
