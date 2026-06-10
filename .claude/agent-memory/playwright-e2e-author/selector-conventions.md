---
name: selector-conventions
description: Selector patterns that work in Agenticket, plus ambiguity pitfalls discovered during testing
metadata:
  type: project
---

## Working selectors

- Login form: `getByLabel('Email')`, `getByLabel('Password')`, `getByRole('button', { name: 'Sign in' })`
- Validation errors: `getByRole('alert').filter({ hasText: '...' })` — Login.tsx renders them as `<p role="alert">`
- Root error (server failure): `getByRole('alert')` — same pattern, root error set by react-hook-form `setError('root', ...)`
- NavBar sign-out: `getByRole('button', { name: 'Sign out' })`
- NavBar links: `getByRole('link', { name: 'Users' })`, `getByRole('link', { name: 'Health' })`
- Page headings: `getByRole('heading', { name: '...' })`
- Login brand: `getByRole('heading', { name: 'Agenticket' })`
- Loading spinner: `getByText('Loading…')` (unicode ellipsis U+2026, not three dots)

## Users page table selectors

- Column headers: `getByRole('columnheader', { name: 'Name' })` etc. — works because `<th>` inside `<thead>`
  has implicit ARIA role `columnheader` even without explicit `scope` attribute.
- Table cells: `getByRole('cell', { name: ADMIN.email })` for email cells
- Row scoping: `page.getByRole('row', { name: new RegExp(ADMIN.email) })` to find a row by email,
  then chain `.getByRole('cell', { name: 'admin', exact: true })` for role badge text
- Role badge: the role text ("admin"/"agent") is inside a `<span>` inside `<td>`, but
  `getByRole('cell', { name: ADMIN.role, exact: true })` resolves correctly via accessible name
- Error paragraph: `getByText('Failed to load users: HTTP 500')` — no role on the error `<p>`
- Subtitle text: `getByText('All accounts with access to Agenticket.')` — exact string match

## Ambiguity pitfall: user name in NavBar

`getByText(ADMIN.name)` where name is 'Admin' matches BOTH:
  1. The NavBar `<span>Admin</span>` (the logged-in user name display)
  2. The Home page `<h1>Welcome, Admin</h1>` heading (contains "Admin")

**Fix**: scope to the banner role — `getByRole('banner').getByText(ADMIN.name)` — 
to target only the NavBar header element.

## Modal and alertdialog selectors

- NewUserModal: `getByRole('dialog', { name: 'Create user' })` — scopes to the create dialog
  - Labels: `getByLabel('Name')` (id=new-user-name), `getByLabel('Email')` (id=new-user-email),
    `getByLabel('Password')` (id=new-user-password)
  - Submit: `getByRole('button', { name: 'Create user' })`
  - Error: `getByText('Failed to create user: <message>')` (plain `<p>` inside the dialog)
- EditUserModal: `getByRole('dialog', { name: 'Edit user' })`
  - Labels: `getByLabel('Name')` (id=edit-user-name), `getByLabel('Email')` (id=edit-user-email)
  - Submit: `getByRole('button', { name: 'Save changes' })`
  - Error: `getByText('Failed to update user: <message>')`
- DeleteUserDialog: `getByRole('alertdialog', { name: 'Delete user' })`
  - User name is in the body text (span inside p) — use `getByText(userName)` scoped to dialog
  - Confirm: `getByRole('button', { name: 'Delete' })`

## No data-testid hooks needed (so far)

All selectors above are stable ARIA/role-based. No data-testid attributes were needed
for the auth, users, or user-management flows.

## Ellipsis character

The "Loading…" text uses Unicode ellipsis (…, U+2026), not three ASCII dots (...).
Match it literally with `getByText('Loading…')`. Both RequireAuth and Users.tsx use this same text.

## role="alert" on form errors

Login.tsx renders field errors and the root server error as `<p role="alert">`.
This is the correct ARIA pattern. Playwright's `getByRole('alert')` finds all of them;
use `.filter({ hasText: '...' })` to select the specific one when multiple are expected.

## page.request for API-level assertions

Use `agentPage.request.get('/api/users')` (not `page.request.fetch`) to make XHR calls
that carry the page context's session cookies. The request goes through the Vite proxy
(5273 → 3101), so cookies are treated as same-origin. Cast response body:
`await response.json() as { error: string }`.
