import { Role } from '@prisma/client';
import { auth } from '../auth.js';
import { prisma } from '../db.js';

// Seeds an admin user from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
// Idempotent: re-running won't duplicate the user, and an existing user
// with that email is promoted to admin rather than recreated.
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  if (existing.role !== Role.admin) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: Role.admin } });
    console.log('promoted existing user to admin:', email);
  } else {
    console.log('admin user already exists:', email);
  }
  process.exit(0);
}

// Create the user + credential account through Better Auth's internal context
// (sign-up is disabled), then assign the admin role.
const ctx = await auth.$context;
const hash = await ctx.password.hash(password);

const user = await ctx.internalAdapter.createUser({
  email,
  name: 'Admin',
  emailVerified: true,
});

await ctx.internalAdapter.createAccount({
  userId: user.id,
  providerId: 'credential',
  accountId: user.id,
  password: hash,
});

await prisma.user.update({ where: { id: user.id }, data: { role: Role.admin } });

console.log('created admin user:', user.id, email);
process.exit(0);
