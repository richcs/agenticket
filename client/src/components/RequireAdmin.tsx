import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Non-admins are bounced to the home page rather than the login screen —
  // they're authenticated, just not authorised for this route.
  if (session.user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
