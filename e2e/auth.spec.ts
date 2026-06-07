// E2E tests for the Agenticket authentication system.
//
// Backend decision: all tests here use the REAL backend + test DB.
// No API mocking — we want to verify the full auth stack (Better Auth,
// Prisma, session cookies) rather than mock it away. The test DB
// (helpdesk_test, postgres-test container) is seeded by globalSetup.
//
// Rate limiting: Better Auth's rate limit is gated on NODE_ENV === 'production'.
// server/.env.test sets NODE_ENV=test, so the `/sign-in/email` clamp (5 req /
// 60 s) is OFF in the test environment. Brute-force throttling CANNOT be
// exercised here without NODE_ENV=production — see the skipped test below.

import { expect, test } from './fixtures/auth.js';
import { ADMIN, AGENT } from './fixtures/credentials.js';

// ── Unauthenticated guards ───────────────────────────────────────────────────

test.describe('unauthenticated access', () => {
  test('visiting / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('visiting /health redirects to /login', async ({ page }) => {
    await page.goto('/health');
    await expect(page).toHaveURL('/login');
  });

  test('visiting /users redirects to /login', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL('/login');
  });

  // Unknown routes redirect to /, which then guards to /login.
  test('visiting an unknown route ends up at /login', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL('/login');
  });
});

// ── Login page form validation ───────────────────────────────────────────────

test.describe('login form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows the Agenticket heading and sign-in prompt', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Agenticket' })).toBeVisible();
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  });

  test('invalid email format shows inline validation error', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('anypassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Enter a valid email address' });
    await expect(alert).toBeVisible();
    // Form must NOT submit — user stays on /login.
    await expect(page).toHaveURL('/login');
  });

  test('empty email shows validation error', async ({ page }) => {
    // Leave email blank, fill password so only email triggers.
    await page.getByLabel('Password').fill('anypassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Enter a valid email address' });
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('empty password shows validation error', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN.email);
    // Leave password blank.
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Password is required' });
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('both fields empty shows both validation errors', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid email address' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Password is required' })).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
});

// ── Login failures (server-side) ─────────────────────────────────────────────

test.describe('login server errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('wrong password shows sign-in failure alert', async ({ page }) => {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The root error set by onSubmit renders as a role=alert paragraph.
    // Accept either the generic fallback or any server message that contains
    // recognisable failure text (Better Auth may return varying messages).
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    // User must remain on the login page — no redirect.
    await expect(page).toHaveURL('/login');
  });

  test('non-existent email shows sign-in failure alert', async ({ page }) => {
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('irrelevant');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  // Brute-force rate limiting CANNOT be exercised in this test environment.
  // Better Auth's rateLimit.enabled is gated on NODE_ENV === 'production',
  // and server/.env.test sets NODE_ENV=test. To test throttling, run the
  // server in production mode with the test DB — that is outside the
  // normal e2e harness scope.
  test.skip('rate limiting blocks repeated failed attempts', async () => {
    // Intentionally skipped — not applicable in NODE_ENV=test.
    // See server/src/auth.ts rateLimit config and server/.env.test.
  });
});

// ── Admin happy path ─────────────────────────────────────────────────────────

test.describe('admin user', () => {
  // Full login flow (exercises the real UI, not just cookie injection).
  test('successful login navigates to home and shows welcome message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: `Welcome, ${ADMIN.name}` })).toBeVisible();
  });

  test('NavBar shows Users link for admin', async ({ adminPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
  });

  test('NavBar shows Health link when signed in', async ({ adminPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Health' })).toBeVisible();
  });

  test('NavBar shows the signed-in user name', async ({ adminPage: page }) => {
    await page.goto('/');
    // The NavBar renders the user name in a <span> inside the <header>.
    // Using a nav-scoped locator avoids the ambiguity with the Welcome heading.
    await expect(page.getByRole('banner').getByText(ADMIN.name)).toBeVisible();
  });

  test('/users is accessible for admin', async ({ adminPage: page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  test('visiting /login while authenticated redirects to /', async ({ adminPage: page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  test('session persists across a full page reload', async ({ adminPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: `Welcome, ${ADMIN.name}` })).toBeVisible();

    // Hard reload — clears JS memory, re-fetches session from cookie.
    await page.reload();
    await expect(page.getByRole('heading', { name: `Welcome, ${ADMIN.name}` })).toBeVisible();
  });

  test('sign out redirects to /login and clears the session', async ({ adminPage: page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    // Confirm the session is truly cleared — protected routes now redirect.
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});

// ── Agent (non-admin) happy path ─────────────────────────────────────────────

test.describe('agent user (non-admin)', () => {
  test('successful login navigates to home and shows welcome message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(AGENT.email);
    await page.getByLabel('Password').fill(AGENT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: `Welcome, ${AGENT.name}` })).toBeVisible();
  });

  test('NavBar does NOT show Users link for agent', async ({ agentPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Users' })).not.toBeVisible();
  });

  test('NavBar shows Health link for agent', async ({ agentPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Health' })).toBeVisible();
  });

  test('navigating to /users as agent redirects to / (not /login)', async ({ agentPage: page }) => {
    await page.goto('/users');
    // RequireAdmin bounces non-admins to / (they are authenticated, just not authorised).
    await expect(page).toHaveURL('/');
    // Must NOT land on /login — that would indicate the session was lost.
    await expect(page).not.toHaveURL('/login');
  });

  test('sign out redirects to /login', async ({ agentPage: page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
  });
});

// ── Loading state ────────────────────────────────────────────────────────────

test.describe('RequireAuth loading state', () => {
  // The "Loading…" spinner is shown while the session query is in flight.
  // It's transient (typically resolves in <100 ms against a local server),
  // so we make it observable by holding the session response with page.route.
  test('protected route shows loading indicator while session is resolving', async ({ page }) => {
    // Intercept the session request and hold it open long enough to assert
    // the loading state, then release it.
    let releaseSession!: () => void;
    const sessionBlocked = new Promise<void>((resolve) => { releaseSession = resolve; });

    await page.route('**/api/auth/get-session', async (route) => {
      // Fetch the real response but hold it until we signal.
      const response = await route.fetch();
      await sessionBlocked;
      await route.fulfill({ response });
    });

    await page.goto('/');

    // Loading… is rendered by RequireAuth while isPending is true.
    await expect(page.getByText('Loading…')).toBeVisible();

    // Release the held response — page should redirect since there's no session.
    releaseSession();
    await expect(page).toHaveURL('/login');
  });
});
