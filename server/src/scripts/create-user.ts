import { auth } from '../auth.js';

// Creates a credential user directly via Better Auth's internal context.
// Needed because public sign-up is disabled (emailAndPassword.disableSignUp).
// The password is stored in the `account` table with providerId "credential",
// which is what email/password sign-in checks against.
const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('usage: create-user <email> <password> [name]');
  process.exit(1);
}

const ctx = await auth.$context;
const hash = await ctx.password.hash(password);

const user = await ctx.internalAdapter.createUser({
  email,
  name: name ?? email,
  emailVerified: true,
});

await ctx.internalAdapter.createAccount({
  userId: user.id,
  providerId: 'credential',
  accountId: user.id,
  password: hash,
});

console.log('created user', user.id, email);
process.exit(0);
