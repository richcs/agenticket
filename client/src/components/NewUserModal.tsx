import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Mirror the server-side rules (server/src/routes/users.ts) so the form rejects
// bad input before a round-trip. Zod trims/normalises as it validates, so the
// parsed output is what we send.
const MIN_PASSWORD_LENGTH = 8;

const createUserSchema = z.object({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: 'Email is required' })
    .pipe(z.email({ error: 'Enter a valid email address' })),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

async function createUser(input: CreateUserInput): Promise<void> {
  try {
    await axios.post('/api/users', input, { withCredentials: true });
  } catch (e) {
    // Prefer the server's message (e.g. duplicate email), falling back to a
    // stable "HTTP <status>" shape — same convention as the list query.
    if (axios.isAxiosError(e) && e.response) {
      const message = (e.response.data as { error?: string } | undefined)?.error;
      throw new Error(message ?? `HTTP ${e.response.status}`);
    }
    throw e;
  }
}

type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

// Map a Zod error to one message per field (first issue wins).
function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !errors[field as keyof FieldErrors]) {
      errors[field as keyof FieldErrors] = issue.message;
    }
  }
  return errors;
}

export default function NewUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      // Refresh the list so the new user appears, then dismiss.
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  // Focus the first field on open and close on Escape.
  useEffect(() => {
    nameRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = createUserSchema.safeParse({ name, email, password });
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    // result.data is normalised (name trimmed, email lower-cased) — send that.
    mutation.mutate(result.data);
  }

  const inputClass =
    'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      // Click the backdrop (but not the panel) to dismiss.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-user-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="new-user-title" className="text-lg font-semibold text-gray-900">
          Create user
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Add a new account with access to Agenticket.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="new-user-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="new-user-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              className={inputClass}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="new-user-email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              className={inputClass}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="new-user-password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              className={inputClass}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          {mutation.isError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Failed to create user: {mutation.error.message}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
