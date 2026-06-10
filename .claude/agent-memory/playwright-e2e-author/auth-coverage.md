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

## Sign-out tests must NOT use adminPage / agentPage fixtures

The admin and agent sign-out tests use `page` (plain unauthenticated fixture) + manual
UI login instead of `adminPage` / `agentPage`. Reason: signing out invalidates the DB
session server-side. Using the shared cookie-jar fixture poisons the worker's
`adminStorageState` for all subsequent tests on that worker — they land on /login
instead of the expected page.

Fix applied in auth.spec.ts: both sign-out tests log in fresh via the UI and sign out,
leaving the shared session untouched.

## Parallel flakiness note — RESOLVED

The original 7-worker default caused the session-poisoning race AND bcrypt timeouts
on early runs. Fixed by:
1. Capping local workers to 4 (playwright.config.ts: `workers: process.env.CI ? 1 : 4`)
2. Fixing sign-out tests to use fresh sessions (not the shared worker cookie jar)
CI still uses `workers: 1` (sequential, no race).

## Spec file: e2e/user-management.spec.ts

Admin-only user CRUD management tests. Uses same fixtures from `e2e/fixtures/auth.ts`.

**Coverage (all passing against real backend)**

**Create**
- Admin opens "New user" dialog, fills Name/Email/Password, submits → modal closes,
  new row appears with correct name/email and role "agent" (server default)
- Duplicate email → 409 from server, "Failed to create user: A user with that email
  already exists" displayed, modal stays open

**Edit**
- Admin clicks Edit on a row, dialog pre-fills with current name/email
- Changes name, saves → dialog closes, row shows updated name
- Edit to duplicate email → 409 from server, error displayed, dialog stays open

**Delete**
- Admin clicks Delete on a row, alertdialog names the user
- Confirms → dialog closes, row disappears from table

**Self-delete protection**
- Delete button is `disabled` on the signed-in admin's own row (UI check)
- `DELETE /api/users/:id` with the admin's own id → 400 "You cannot delete your own account"
  (API-level check via page.request.delete)

**Test isolation strategy**
- Each test that creates/edits/deletes uses `uniqueEmail(label)` (Date.now + random)
- Tests that need a target user (edit, delete) create one via `createUserViaUI` helper
  before the actual assertion — fully hermetic, no dependency on seeded AGENT user
- 15s timeouts on mutation-dependent assertions (modal close, row appear/disappear)
  to accommodate bcrypt + DB round-trips under parallel load
