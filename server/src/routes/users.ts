import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      image: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});
