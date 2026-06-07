---
name: auth-coverage
description: Auth flows covered by e2e/auth.spec.ts, what's skipped and why, fixture pattern used
metadata:
  type: project
---

## Spec file: e2e/auth.spec.ts

Uses `test` from `e2e/fixtures/auth.ts` (extends baseTest with `adminPage` / `agentPage` fixtures).
Credentials defined in `e2e/fixtures/credentials.ts`.

## Coverage (all passing as of 2026-06-07)

**Unauthenticated guards**
- `/`, `/health`, `/users` each redirect to `/login` when not signed in
- Unknown route (`*`) redirects to `/` then to `/login`

**Login form validation (client-side, Zod)**
- Heading/branding renders
- Invalid email format → "Enter a valid email address" alert
- Empty email → "Enter a valid email address" alert
- Empty password → "Password is required" alert
- Both empty → both alerts simultaneously

**Login server errors (real backend)**
- Wrong password → `role="alert"` visible, stays on `/login`
- Non-existent email → `role="alert"` visible, stays on `/login`

**Admin happy path**
- Full UI login → redirects to `/`, shows "Welcome, Admin"
- NavBar: Users link visible, Health link visible, user name in `<header>` (`getByRole('banner')`)
- `/users` renders heading "Users"
- `/login` while authenticated → redirects to `/`
- Session persists across page.reload()
- Sign out → `/login`, then protected routes redirect back to `/login`

**Agent happy path**
- Full UI login → redirects to `/`, shows "Welcome, Test Agent"
- NavBar: Users link NOT visible, Health link visible
- `/users` as agent → redirects to `/` (NOT `/login` — RequireAdmin behaviour)
- Sign out → `/login`

**Loading state**
- `page.route` holds `GET /api/auth/get-session` response; asserts "Loading…" visible, then releases → redirects to `/login`

## Intentionally skipped

```ts
test.skip('rate limiting blocks repeated failed attempts')
```
Rate limiting is gated on `NODE_ENV === 'production'`; `.env.test` sets `NODE_ENV=test`.
Cannot be exercised in the standard e2e harness. Clearly documented in the spec.

## Backend decision

All auth tests use the **real backend + test DB**. No API mocking. Rationale: auth
correctness depends on Better Auth, Prisma, and session cookies working end-to-end.
Mocking would mask real failures (e.g. password hashing, cookie domain issues).

## Fixture pattern

Worker-scoped fixtures in `e2e/fixtures/auth.ts`:
- `adminStorageState` / `agentStorageState` — log in once per worker, save cookie-jar to disk
- `adminPage` / `agentPage` — test-scoped, creates new context with the saved cookie-jar
- `globalSetup` clears `playwright/.auth/` at start of each run to prevent stale tokens
