import { type Request, type Response, type NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

// Server-side auth/authz guards. Client-side route guards (RequireAuth /
// RequireAdmin in the React app) only control what the UI renders — they are
// trivially bypassed by calling the API directly. Every protected /api route
// must sit behind these, since they are the real security boundary.
//
// `requireAuth` resolves the session and stashes it on res.locals so a
// following guard or handler can reuse it without re-querying.

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.locals.session = session;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session =
    res.locals.session ?? (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }));
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (session.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.locals.session = session;
  next();
}
