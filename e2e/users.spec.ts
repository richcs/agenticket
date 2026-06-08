// E2E tests for the admin-only Users page (/users).
//
// Backend decision: all UI tests use the REAL backend + test DB.
// The seeded users (ADMIN and AGENT) are created by globalSetup and are
// therefore present in every row assertion. API-level authorization tests
// (403/401) also use the real backend — they verify the actual server-side
// guard (requireAuth + requireAdmin), not just the client-side redirect.
//
// Access control breadth:
//   - Unauthenticated → /login               (covered in auth.spec.ts)
//   - Agent (non-admin) → / (client-side)    (covered in auth.spec.ts)
//   - Agent (non-admin) → 403 (API level)    (covered here — real security boundary)
//   - Admin → sees table                     (covered here)

import { expect, test } from './fixtures/auth.js';
import { ADMIN, AGENT } from './fixtures/credentials.js';

// ── Admin: table content ─────────────────────────────────────────────────────

test.describe('admin user on /users', () => {
  test('renders the page heading and subtitle', async ({ adminPage: page }) => {
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByText('All accounts with access to Agenticket.')).toBeVisible();
  });

  test('renders all five table column headers', async ({ adminPage: page }) => {
    await page.goto('/users');
    // Wait for the column headers to appear, which confirms the table has loaded.
    // Use getByRole('columnheader') directly — the <th> elements have the
    // implicit columnheader role even when the parent <table> is not easily
    // targeted via getByRole('table') due to surrounding layout divs.
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Verified' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
  });

  test('shows the seeded admin user in the table', async ({ adminPage: page }) => {
    await page.goto('/users');
    // Wait for the table body to render by checking for a known cell value.
    const adminEmailCell = page.getByRole('cell', { name: ADMIN.email });
    await expect(adminEmailCell).toBeVisible();

    // Find the row that contains the admin's email cell, then assert sibling cells.
    const adminRow = page.getByRole('row', { name: new RegExp(ADMIN.email) });
    // Name cell — exact match avoids substring clash with "admin@example.com".
    await expect(adminRow.getByRole('cell', { name: ADMIN.name, exact: true })).toBeVisible();
    await expect(adminRow.getByRole('cell', { name: ADMIN.email })).toBeVisible();
    // Role badge is inside a <span> within a <td>; target the cell and check inner text.
    await expect(adminRow.getByRole('cell', { name: ADMIN.role, exact: true })).toBeVisible();
    // emailVerified is true for seeded users (seed-test-users.ts passes emailVerified: true).
    await expect(adminRow.getByRole('cell', { name: 'Yes' })).toBeVisible();
  });

  test('shows the seeded agent user in the table', async ({ adminPage: page }) => {
    await page.goto('/users');
    const agentEmailCell = page.getByRole('cell', { name: AGENT.email });
    await expect(agentEmailCell).toBeVisible();

    const agentRow = page.getByRole('row', { name: new RegExp(AGENT.email) });
    await expect(agentRow.getByRole('cell', { name: AGENT.name, exact: true })).toBeVisible();
    await expect(agentRow.getByRole('cell', { name: AGENT.email })).toBeVisible();
    await expect(agentRow.getByRole('cell', { name: AGENT.role, exact: true })).toBeVisible();
    await expect(agentRow.getByRole('cell', { name: 'Yes' })).toBeVisible();
  });

  test('NavBar Users link navigates to /users', async ({ adminPage: page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  //
  // While the /api/users request is in flight, Users.tsx renders the table
  // shell (real column headers) and 5 skeleton rows
  // (<tr data-testid="user-skeleton-row" aria-hidden="true">).
  // We hold the response to observe this transient state, then release it.
  test('shows skeleton rows while the user list is in flight', async ({ adminPage: page }) => {
    let releaseUsers!: () => void;
    const usersBlocked = new Promise<void>((resolve) => { releaseUsers = resolve; });

    await page.route('**/api/users', async (route) => {
      const response = await route.fetch();
      await usersBlocked;
      await route.fulfill({ response });
    });

    await page.goto('/users');

    // While the request is held the component renders 5 skeleton rows.
    const skeletonRows = page.getByTestId('user-skeleton-row');
    await expect(skeletonRows.first()).toBeVisible();
    await expect(skeletonRows).toHaveCount(5);

    // Release — real data loads, skeleton rows are replaced by real user rows.
    releaseUsers();
    // A known seeded user's email cell appearing confirms the real rows rendered.
    await expect(page.getByRole('cell', { name: ADMIN.email })).toBeVisible();
    await expect(skeletonRows).toHaveCount(0);
  });

  // ── Error state ────────────────────────────────────────────────────────────
  //
  // When /api/users returns a non-OK status, Users.tsx sets the error state
  // and renders "Failed to load users: HTTP <status>".
  test('shows error message when the API returns an error', async ({ adminPage: page }) => {
    await page.route('**/api/users', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/users');

    await expect(page.getByText('Failed to load users: HTTP 500')).toBeVisible();
    // Column headers must NOT render when there is an error (table is absent).
    await expect(page.getByRole('columnheader', { name: 'Name' })).not.toBeVisible();
  });
});

// ── API-level authorization ──────────────────────────────────────────────────
//
// The client-side RequireAdmin guard only controls what the UI renders.
// The real security boundary is requireAuth + requireAdmin on the server.
// These tests call the API directly (bypassing the React app) to verify
// that the server enforces authorization regardless of the client state.

test.describe('GET /api/users authorization', () => {
  test('returns 403 for an authenticated agent', async ({ agentPage: page }) => {
    // page already has the agent's session cookies. Perform an XHR from within
    // the page context so the cookies are sent (same-origin from 5273 → 3101 proxy).
    const response = await page.request.get('/api/users');
    expect(response.status()).toBe(403);

    const body = await response.json() as { error: string };
    expect(body.error).toBe('Forbidden');
  });

  test('returns 401 for an unauthenticated request', async ({ page }) => {
    // `page` fixture is the plain unauthenticated page — no session cookies.
    const response = await page.request.get('/api/users');
    expect(response.status()).toBe(401);

    const body = await response.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });
});
