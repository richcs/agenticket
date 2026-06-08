import { useEffect, useState } from 'react';
import axios from 'axios';
import NavBar from '../components/NavBar';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default function Users() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    axios
      .get<{ users: UserRow[] }>('/api/users', {
        withCredentials: true,
        signal: controller.signal,
      })
      .then((res) => setUsers(res.data.users))
      .catch((e: unknown) => {
        if (axios.isCancel(e)) return;
        // Preserve the "HTTP <status>" shape so the message is stable regardless
        // of axios's default error text.
        if (axios.isAxiosError(e) && e.response) {
          setError(`HTTP ${e.response.status}`);
        } else {
          setError(e instanceof Error ? e.message : 'Request failed');
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <p className="mt-1 mb-6 text-sm text-gray-600">
          All accounts with access to Agenticket.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load users: {error}
          </p>
        )}

        {!users && !error && <p className="text-gray-500">Loading…</p>}

        {users && users.length === 0 && (
          <p className="text-gray-500">No users found.</p>
        )}

        {users && users.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Verified</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
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
          </div>
        )}
      </main>
    </div>
  );
}
