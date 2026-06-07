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

## Ambiguity pitfall: user name in NavBar

`getByText(ADMIN.name)` where name is 'Admin' matches BOTH:
  1. The NavBar `<span>Admin</span>` (the logged-in user name display)
  2. The Home page `<h1>Welcome, Admin</h1>` heading (contains "Admin")

**Fix**: scope to the banner role — `getByRole('banner').getByText(ADMIN.name)` — 
to target only the NavBar header element.

## No data-testid hooks needed (so far)

All selectors above are stable ARIA/role-based. No data-testid attributes were needed
for the auth flows. If future components lack good ARIA roles, recommend adding data-testid.

## Ellipsis character

The "Loading…" text uses Unicode ellipsis (…, U+2026), not three ASCII dots (...).
Match it literally with `getByText('Loading…')`.

## role="alert" on form errors

Login.tsx renders field errors and the root server error as `<p role="alert">`.
This is the correct ARIA pattern. Playwright's `getByRole('alert')` finds all of them;
use `.filter({ hasText: '...' })` to select the specific one when multiple are expected.
