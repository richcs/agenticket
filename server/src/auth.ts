import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// Better Auth instance. Reuses the shared `prisma` singleton (never instantiate
// PrismaClient elsewhere — see CLAUDE.md). Sessions persist to the database by
// default (no secondaryStorage / cookieCache configured).
export const auth = betterAuth({
  appName: 'Agenticket',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    // No public registration — users are created via the create-user script.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // Application role: 'admin' or 'agent'. Assigned server-side
      // (seed script / admin tooling), never via the auth API.
      role: {
        type: 'string',
        required: false,
        defaultValue: 'agent',
        input: false,
      },
    },
  },
  // CSRF / origin allow-list for the Vite dev client.
  trustedOrigins: [CLIENT_ORIGIN],
});
