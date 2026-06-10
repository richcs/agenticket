import { useEffect } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type DeletableUser = { id: string; name: string };

async function deleteUser(id: string): Promise<void> {
  try {
    await axios.delete(`/api/users/${id}`, { withCredentials: true });
  } catch (e) {
    // Prefer the server's message (e.g. "You cannot delete your own account"),
    // falling back to a stable "HTTP <status>" shape.
    if (axios.isAxiosError(e) && e.response) {
      const message = (e.response.data as { error?: string } | undefined)?.error;
      throw new Error(message ?? `HTTP ${e.response.status}`);
    }
    throw e;
  }
}

export default function DeleteUserDialog({
  user,
  onClose,
}: {
  user: DeletableUser;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: async () => {
      // Drop the deleted row from the list, then dismiss.
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  // Close on Escape.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      // Click the backdrop (but not the panel) to dismiss.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        aria-describedby="delete-user-desc"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="delete-user-title" className="text-lg font-semibold text-gray-900">
          Delete user
        </h2>
        <p id="delete-user-desc" className="mt-2 text-sm text-gray-600">
          Are you sure you want to delete <span className="font-medium text-gray-900">{user.name}</span>?
          This permanently removes the account and can't be undone.
        </p>

        {mutation.isError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Failed to delete user: {mutation.error.message}
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
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
