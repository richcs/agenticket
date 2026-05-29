import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
