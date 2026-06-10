import { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import NavBar from '../components/NavBar';
import NewUserModal from '../components/NewUserModal';
import { Skeleton } from '../components/ui/skeleton';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
};

const COLUMNS = ['Name', 'Email', 'Role', 'Verified', 'Created'] as const;

// Roughly matches the real column content widths so the skeleton doesn't jump
// when the data arrives.
const SKELETON_WIDTHS = ['w-32', 'w-48', 'w-12', 'w-8', 'w-20'];
const SKELETON_ROWS = 5;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

async function fetchUsers({ signal }: { signal: AbortSignal }): Promise<UserRow[]> {
  try {
    const res = await axios.get<{ users: UserRow[] }>('/api/users', {
      withCredentials: true,
      signal,
    });
    return res.data.users;
  } catch (e) {
    // Preserve the "HTTP <status>" shape so the message is stable regardless
    // of axios's default error text.
    if (axios.isAxiosError(e) && e.response) {
      throw new Error(`HTTP ${e.response.status}`);
    }
    throw e;
  }
}

export default function Users() {
  const [showNewUser, setShowNewUser] = useState(false);
  const {
    data: users,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    // Surface load failures immediately rather than retrying 3× (the default),
    // which would delay the error UI by several seconds. The query still
    // refetches on window focus / reconnect.
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
            <p className="mt-1 text-sm text-gray-600">
              All accounts with access to Agenticket.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewUser(true)}
            className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            New user
          </button>
        </div>

        {isError && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load users: {error.message}
          </p>
        )}

        {!isError && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left font-medium text-gray-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isPending
                  ? Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                      <tr key={rowIndex} data-testid="user-skeleton-row" aria-hidden="true">
                        {SKELETON_WIDTHS.map((width, colIndex) => (
                          <td key={colIndex} className="px-4 py-3">
                            <Skeleton className={`h-4 ${width}`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                        <td className="px-4 py-3 text-gray-700">{user.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              user.role === 'admin'
                                ? 'inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700'
                                : 'inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
                            }
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {user.emailVerified ? 'Yes' : 'No'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {dateFormatter.format(new Date(user.createdAt))}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>

            {!isPending && users.length === 0 && (
              <p className="px-4 py-6 text-center text-gray-500">No users found.</p>
            )}
          </div>
        )}
      </main>

      {showNewUser && <NewUserModal onClose={() => setShowNewUser(false)} />}
    </div>
  );
}
