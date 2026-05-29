import { createAuthClient } from 'better-auth/react';

// baseURL is omitted on purpose: it defaults to the current origin
// (http://localhost:5173 in dev), and the Vite proxy forwards /api/auth/*
// to the backend on :3001. This works unchanged in production too, since
// the frontend and API are served from the same origin.
export const authClient = createAuthClient();

export const { useSession, signIn, signOut } = authClient;
