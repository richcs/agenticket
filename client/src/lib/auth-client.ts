import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

// baseURL is omitted on purpose: it defaults to the current origin
// (http://localhost:5173 in dev), and the Vite proxy forwards /api/auth/*
// to the backend on :3001. This works unchanged in production too, since
// the frontend and API are served from the same origin.
export const authClient = createAuthClient({
  // Surface the server-side `role` additional field on the client session.
  // Kept in sync with the `user.additionalFields` config in server/src/auth.ts.
  plugins: [inferAdditionalFields({ user: { role: { type: 'string' } } })],
});

export const { useSession, signIn, signOut } = authClient;
