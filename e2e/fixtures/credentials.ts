// Central definition of test user credentials.
// Referenced by global-setup (to seed) and all auth specs (to log in).
// Never hardcode these strings in spec files — import from here instead.

export type Credentials = {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role: string;
};

export const ADMIN: Credentials = {
  email: 'admin@example.com',
  password: 'password123',
  name: 'Admin',
  role: 'admin',
} as const;

export const AGENT: Credentials = {
  email: 'agent@example.com',
  password: 'agentpass123',
  name: 'Test Agent',
  role: 'agent',
} as const;
