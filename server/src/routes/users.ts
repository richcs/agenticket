import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { auth } from '../auth.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

// Password length bounds match Better Auth's defaults; sign-in checks the same
// hash, so a password the API would reject here would be unusable anyway.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Shared field schemas. Zod trims/normalises as it validates, so handlers work
// with clean values (name trimmed, email lower-cased).
const nameField = z.string().trim().min(1, { error: 'Name is required' });
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: 'Email is required' })
  .pipe(z.email({ error: 'Email is invalid' }));

// Request-body schemas. Create needs a password; edit changes name + email only.
const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
    .max(MAX_PASSWORD_LENGTH, { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` }),
});

const updateUserSchema = z.object({
  name: nameField,
  email: emailField,
});

// Non-sensitive projection returned by every endpoint (passwords live on the
// Account model and are never exposed here).
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  image: true,
  createdAt: true,
} as const;

// Admin-only user management. Mounted at /api/users in index.ts.
// Both guards run on every route: requireAuth resolves the session,
// requireAdmin enforces the 'admin' role (the real security boundary —
// the client-side RequireAdmin guard only controls what the UI renders).
export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

// GET /api/users — list all users. Selects only non-sensitive fields
// (passwords live on the Account model and are never exposed here).
// Express 5 forwards rejected promises to the error handler in index.ts,
// so async handlers need no try/catch.
usersRouter.get('/', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});

// POST /api/users — create a credential user (name + email + password).
// Public sign-up is disabled (emailAndPassword.disableSignUp), so we create the
// account the same way the create-user script does: hash via Better Auth's
// context and write the user + 'credential' account through the internal
// adapter. New users default to the 'agent' role (schema default).
usersRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    // The client renders a single error string, so surface the first issue.
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const { name, email, password } = parsed.data;

  // Email is unique; check before hashing so duplicates return a clean 409
  // rather than surfacing a Prisma constraint error through the 500 handler.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists' });
    return;
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const user = await ctx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
  });
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hash,
  });

  // Re-read through the same projection the list endpoint uses so the client
  // gets a consistent shape (createUser's return type omits `role`).
  const created = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: userSelect,
  });
  res.status(201).json({ user: created });
});

// PATCH /api/users/:id — edit a user's name + email (admin-only, like the
// rest of the router). Role and password are out of scope here.
usersRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const { name, email } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Email is unique; allow keeping the same address but reject one already
  // taken by a different user (clean 409 instead of a Prisma constraint 500).
  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== id) {
    res.status(409).json({ error: 'A user with that email already exists' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { name, email },
    select: userSelect,
  });
  res.json({ user: updated });
});

// DELETE /api/users/:id — remove a user. Related session/account rows cascade
// (see schema.prisma onDelete: Cascade). Admins can't delete their own account,
// which would risk locking the last admin out.
usersRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const session = res.locals.session as { user: { id: string } };

  if (session.user.id === id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  await prisma.user.delete({ where: { id } });
  res.status(204).end();
});
