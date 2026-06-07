// Idempotent seeder for the test database.
// Called by globalSetup (via execSync) AFTER migrations are applied.
//
// Creates the admin user (via the same logic as db:seed) and a non-admin
// agent user. Safe to run repeatedly — existing users are left untouched.
//
// Run environment: env vars from server/.env.test are passed in via the
// `env` option of execSync, so DATABASE_URL, BETTER_AUTH_SECRET, etc.
// already point at the test DB.

import { Role } from '@prisma/client';
import { auth } from '../server/src/auth.js';
import { prisma } from '../server/src/db.js';

type UserSeed = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

const users: UserSeed[] = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'password123',
    name: 'Admin',
    role: Role.admin,
  },
  {
    email: 'agent@example.com',
    password: 'agentpass123',
    name: 'Test Agent',
    role: Role.agent,
  },
];

async function seed() {
  const ctx = await auth.$context;

  for (const userData of users) {
    const existing = await prisma.user.findUnique({ where: { email: userData.email } });

    if (existing) {
      // Ensure the role is correct (e.g. if the container persisted between runs).
      if (existing.role !== userData.role) {
        await prisma.user.update({ where: { id: existing.id }, data: { role: userData.role } });
        console.log(`[seed] promoted ${userData.email} to ${userData.role}`);
      } else {
        console.log(`[seed] ${userData.email} already exists, skipping`);
      }
      continue;
    }

    const hash = await ctx.password.hash(userData.password);

    const user = await ctx.internalAdapter.createUser({
      email: userData.email,
      name: userData.name,
      emailVerified: true,
    });

    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hash,
    });

    if (userData.role !== Role.agent) {
      await prisma.user.update({ where: { id: user.id }, data: { role: userData.role } });
    }

    console.log(`[seed] created ${userData.role} user: ${userData.email}`);
  }

  await prisma.$disconnect();
}

seed().catch((err: unknown) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
