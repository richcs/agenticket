---
name: auth-coverage
description: Auth flows covered by e2e/auth.spec.ts and users flows covered by e2e/users.spec.ts, what's skipped and why, fixture pattern used
metadata:
  type: project
---

## Spec file: e2e/auth.spec.ts

Uses `test` from `e2e/fixtures/auth.ts` (extends baseTest with `adminPage` / `agentPage` fixtures).
Credentials defined in `e2e/fixtures/credentials.ts`.

## Coverage (all passing)

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

## Spec file: e2e/users.spec.ts

Admin-only /users page tests. Uses same fixtures from `e2e/fixtures/auth.ts`.

**Admin: page content (real backend)**
- Heading "Users" and subtitle "All accounts with access to Agenticket." visible
- All five column headers: Name, Email, Role, Verified, Created
- Seeded admin user row: name, email, role="admin", Verified="Yes"
- Seeded agent user row: name, email, role="agent", Verified="Yes"
- NavBar "Users" link navigates from `/` to `/users`

**Admin: loading state (mocked API)**
- `page.route` holds `GET /api/users`; asserts "Loading…" visible, releases → table appears

**Admin: error state (mocked API)**
- `page.route` returns HTTP 500; asserts "Failed to load users: HTTP 500" visible, table absent

**API-level authorization (real backend)**
- `GET /api/users` via agent session cookies → 403 `{ error: "Forbidden" }`
- `GET /api/users` unauthenticated → 401 `{ error: "Unauthorized" }`

## Backend decision

All auth tests and API-level authorization tests use the **real backend + test DB**.
Loading/error state tests use `page.route` to mock `GET /api/users` responses since
these states are transient and deterministic mocking is the only reliable way to observe them.

## Fixture pattern

Worker-scoped fixtures in `e2e/fixtures/auth.ts`:
- `adminStorageState` / `agentStorageState` — log in once per worker, save cookie-jar to disk
- `adminPage` / `agentPage` — test-scoped, creates new context with the saved cookie-jar
- `globalSetup` clears `playwright/.auth/` at start of each run to prevent stale tokens

## Parallel flakiness note

On the first `npm run test:e2e` of a fresh run with 7 parallel workers, all workers race
to capture admin cookie jars simultaneously. This can cause a transient "Target page/context
closed" failure on one test. On the second run (jars warm) it's fully stable. This is
inherent to the current worker-scoped fixture strategy — not a test bug. To eliminate it,
cap workers to 2 or use a shared pre-auth step, but this has not been needed in practice
(CI uses `workers: 1`).
