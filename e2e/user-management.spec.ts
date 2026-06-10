// E2E tests for admin user-management on the Users page (/users).
//
// Covers: create, edit, delete, duplicate-email error, and self-delete protection.
//
// Backend decision:
//   All five flows use the REAL backend + test DB (helpdesk_test on :5433).
//   These are end-to-end user journeys; mocking the API would bypass the very
//   mutations we want to verify. The only exception is the direct API call in
//   the self-delete protection test, which also goes through the real backend.
//
// Test isolation:
//   Each test that creates a user uses a unique email derived from Date.now() +
//   Math.random() so parallel workers never collide. No teardown is needed
//   because the test DB is ephemeral (postgres-test runs on tmpfs and is wiped
//   each run by globalSetup).
//
// Seeded users available in every test:
//   ADMIN  — admin@example.com   (role: admin)  — the signed-in user in adminPage
//   AGENT  — agent@example.com   (role: agent)
//
// Each test that mutates a user (edit, delete) creates its own target user via
// the UI so it doesn't depend on or consume the seeded AGENT user.

import { expect, test } from './fixtures/auth.js';
import { ADMIN } from './fixtures/credentials.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns a unique email safe to use as a test user per test run.
function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

// Creates a new user via the UI and waits for the new row to appear in the
// table. The "New user" button click auto-waits for the button to be present
// (Playwright web-first auto-waiting), so no explicit table-ready check is
// needed before calling this helper.
async function createUserViaUI(
  page: import('@playwright/test').Page,
  opts: { name: string; email: string; password: string },
): Promise<void> {
  // Open the modal. Playwright auto-waits for the button to be actionable.
  await page.getByRole('button', { name: 'New user' }).click();

  const dialog = page.getByRole('dialog', { name: 'Create user' });
  await expect(dialog).toBeVisible();

  // Fill fields using their labels (htmlFor → id linkage).
  await dialog.getByLabel('Name').fill(opts.name);
  await dialog.getByLabel('Email').fill(opts.email);
  await dialog.getByLabel('Password').fill(opts.password);

  // Submit and wait for the modal to close (success path).
  await dialog.getByRole('button', { name: 'Create user' }).click();
  // The modal dismisses after queryClient.invalidateQueries resolves; give it
  // a generous timeout since the DB round-trip can be slow under parallel load.
  await expect(dialog).not.toBeVisible({ timeout: 15000 });

  // Confirm the new row is in the table (also allow extra time for the refetch).
  await expect(page.getByRole('cell', { name: opts.email })).toBeVisible({ timeout: 15000 });
}

// ── Create ────────────────────────────────────────────────────────────────────

test.describe('user creation', () => {
  test('creates a new user and shows them in the table', async ({ adminPage: page }) => {
    await page.goto('/users');

    const name = 'New E2E User';
    const email = uniqueEmail('create');
    const password = 'SecurePass1!';

    await createUserViaUI(page, { name, email, password });

    // The row should be present with the correct name and email.
    const newRow = page.getByRole('row', { name: new RegExp(email) });
    await expect(newRow.getByRole('cell', { name, exact: true })).toBeVisible();
    await expect(newRow.getByRole('cell', { name: email })).toBeVisible();
    // New users are created as 'agent' (server-side default).
    await expect(newRow.getByRole('cell', { name: 'agent', exact: true })).toBeVisible();
  });

  test('shows inline error when creating a user with a duplicate email', async ({
    adminPage: page,
  }) => {
    await page.goto('/users');

    // Open the modal and submit with ADMIN's email (guaranteed to exist).
    // The button click auto-waits for the button to be actionable (page ready).
    await page.getByRole('button', { name: 'New user' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create user' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Name').fill('Duplicate');
    await dialog.getByLabel('Email').fill(ADMIN.email);
    await dialog.getByLabel('Password').fill('SecurePass1!');
    await dialog.getByRole('button', { name: 'Create user' }).click();

    // Modal stays open and the server's 409 message is displayed.
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Failed to create user: A user with that email already exists'),
    ).toBeVisible();
  });
});

// ── Edit ──────────────────────────────────────────────────────────────────────

test.describe('user editing', () => {
  test('pre-fills the edit dialog and updates the row on save', async ({ adminPage: page }) => {
    await page.goto('/users');

    // Create a dedicated target user so this test is self-contained.
    // createUserViaUI's button click auto-waits for the page to be ready.
    const originalName = 'Edit Target';
    const originalEmail = uniqueEmail('edit');
    await createUserViaUI(page, {
      name: originalName,
      email: originalEmail,
      password: 'SecurePass1!',
    });

    // Click Edit on the target row.
    const targetRow = page.getByRole('row', { name: new RegExp(originalEmail) });
    await targetRow.getByRole('button', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit user' });
    await expect(dialog).toBeVisible();

    // Verify pre-fill — the Name field should already contain the original name.
    await expect(dialog.getByLabel('Name')).toHaveValue(originalName);
    // The email field should contain the original email.
    await expect(dialog.getByLabel('Email')).toHaveValue(originalEmail);

    // Change the name.
    const updatedName = 'Edited Name';
    await dialog.getByLabel('Name').fill(updatedName);

    // Submit and wait for the dialog to close.
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).not.toBeVisible();

    // The row should now show the updated name.
    const updatedRow = page.getByRole('row', { name: new RegExp(originalEmail) });
    await expect(updatedRow.getByRole('cell', { name: updatedName, exact: true })).toBeVisible();
    // Original name should be gone from that row.
    await expect(updatedRow.getByRole('cell', { name: originalName, exact: true })).not.toBeVisible();
  });

  test('shows inline error when saving a duplicate email', async ({ adminPage: page }) => {
    await page.goto('/users');

    // Create a target user to edit.
    const targetEmail = uniqueEmail('edit-dup');
    await createUserViaUI(page, {
      name: 'Dup Edit Target',
      email: targetEmail,
      password: 'SecurePass1!',
    });

    // Open Edit on the target.
    const targetRow = page.getByRole('row', { name: new RegExp(targetEmail) });
    await targetRow.getByRole('button', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit user' });
    await expect(dialog).toBeVisible();

    // Try to change the email to the admin's (already exists).
    await dialog.getByLabel('Email').fill(ADMIN.email);
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    // Dialog stays open, server 409 error displayed.
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Failed to update user: A user with that email already exists'),
    ).toBeVisible();
  });
});

// ── Delete ────────────────────────────────────────────────────────────────────

test.describe('user deletion', () => {
  test('deletes a user and removes them from the table', async ({ adminPage: page }) => {
    await page.goto('/users');

    // Create a dedicated target user to delete.
    const targetEmail = uniqueEmail('delete');
    const targetName = 'Delete Target';
    await createUserViaUI(page, {
      name: targetName,
      email: targetEmail,
      password: 'SecurePass1!',
    });

    // Click Delete on the target row.
    const targetRow = page.getByRole('row', { name: new RegExp(targetEmail) });
    await targetRow.getByRole('button', { name: 'Delete' }).click();

    // The alertdialog should open naming the user.
    const alertDialog = page.getByRole('alertdialog', { name: 'Delete user' });
    await expect(alertDialog).toBeVisible();
    // The user's name appears in the confirmation body.
    await expect(alertDialog.getByText(targetName)).toBeVisible();

    // Confirm the deletion.
    await alertDialog.getByRole('button', { name: 'Delete' }).click();

    // Dialog closes and the row disappears (after invalidateQueries refetch).
    await expect(alertDialog).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('cell', { name: targetEmail })).not.toBeVisible({ timeout: 15000 });
  });
});

// ── Self-delete protection ────────────────────────────────────────────────────

test.describe('self-delete protection', () => {
  test("the signed-in admin's own Delete button is disabled", async ({ adminPage: page }) => {
    await page.goto('/users');

    // Wait for the table to load; allow extra time for the DB round-trip under
    // parallel worker load.
    await expect(page.getByRole('cell', { name: ADMIN.email })).toBeVisible({ timeout: 15000 });

    // Find the admin's own row and check that the Delete button is disabled.
    const adminRow = page.getByRole('row', { name: new RegExp(ADMIN.email) });
    const deleteButton = adminRow.getByRole('button', { name: 'Delete' });
    await expect(deleteButton).toBeDisabled();

    // The Edit button on the same row should still be enabled (not affected).
    const editButton = adminRow.getByRole('button', { name: 'Edit' });
    await expect(editButton).toBeEnabled();
  });

  test('DELETE /api/users/:id returns 400 when the admin deletes their own account', async ({
    adminPage: page,
  }) => {
    // Resolve the admin's user id from the session endpoint, then hit the
    // delete API directly with the admin's own session cookies.
    const sessionRes = await page.request.get('/api/auth/get-session');
    expect(sessionRes.status()).toBe(200);
    const session = await sessionRes.json() as { user: { id: string } };
    const adminId = session.user.id;

    const deleteRes = await page.request.delete(`/api/users/${adminId}`);
    expect(deleteRes.status()).toBe(400);

    const body = await deleteRes.json() as { error: string };
    expect(body.error).toBe('You cannot delete your own account');
  });
});
