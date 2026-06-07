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
  // Rate limiting is enabled only in production (explicitly gated on NODE_ENV so
  // it stays off in dev and test). The global window is generous, so clamp the
  // credential sign-in path hard to blunt password brute-forcing against the
  // known, sign-up-disabled account set.
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
    },
  },
});
