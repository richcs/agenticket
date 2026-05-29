import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, useSession } from '../lib/auth-client';

export default function NavBar() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-gray-900">
            Agenticket
          </Link>
          {session && (
            <Link to="/health" className="text-sm text-gray-600 hover:text-gray-900">
              Health
            </Link>
          )}
        </div>

        {session && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">{session.user.name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
