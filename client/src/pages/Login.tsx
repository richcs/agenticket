import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { signIn, useSession } from '../lib/auth-client';

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

const baseFieldClass =
  'w-full rounded-md border px-3 py-2 text-gray-900 outline-none focus:ring-1';
const validFieldClass = 'border-gray-300 focus:border-gray-900 focus:ring-gray-900';
const invalidFieldClass = 'border-red-500 focus:border-red-500 focus:ring-red-500';

function fieldClass(hasError: boolean) {
  return `${baseFieldClass} ${hasError ? invalidFieldClass : validFieldClass}`;
}

export default function Login() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = useSession();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Already signed in — skip the form.
  if (!sessionPending && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(values: LoginValues) {
    const { error } = await signIn.email(values);

    if (error) {
      setError('root', {
        message: error.message ?? 'Sign in failed. Check your credentials.',
      });
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">Agenticket</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              aria-invalid={errors.email ? true : undefined}
              className={fieldClass(!!errors.email)}
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              aria-invalid={errors.password ? true : undefined}
              className={fieldClass(!!errors.password)}
            />
            {errors.password && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-sm text-red-600">
              {errors.root.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-gray-900 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
