import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import DeleteUserDialog from './DeleteUserDialog';
import { renderWithQuery } from '../test/renderWithQuery';

// The dialog deletes via axios.delete and reshapes failures with axios.isAxiosError.
vi.mock('axios', () => {
  const del = vi.fn();
  const isAxiosError = vi.fn();
  return { default: { delete: del, isAxiosError } };
});

const mockedDelete = vi.mocked(axios.delete);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

const user = { id: 'u1', name: 'Ada Lovelace' };

function renderDialog(onClose = vi.fn()) {
  const utils = renderWithQuery(<DeleteUserDialog user={user} onClose={onClose} />);
  return { onClose, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeleteUserDialog', () => {
  it('names the user being deleted in the confirmation', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Ada Lovelace');
    expect(dialog).toHaveTextContent("can't be undone");
  });

  it('deletes the user with credentials and closes on confirm', async () => {
    const u = userEvent.setup();
    mockedDelete.mockResolvedValue({ status: 204 });
    const { onClose } = renderDialog();

    await u.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledTimes(1));
    expect(mockedDelete).toHaveBeenCalledWith(
      '/api/users/u1',
      expect.objectContaining({ withCredentials: true }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('surfaces the server error message and stays open on failure', async () => {
    const u = userEvent.setup();
    mockedIsAxiosError.mockReturnValue(true);
    mockedDelete.mockRejectedValue({
      response: { status: 400, data: { error: 'You cannot delete your own account' } },
    });
    const { onClose } = renderDialog();

    await u.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('Failed to delete user: You cannot delete your own account'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without deleting when Cancel is clicked', async () => {
    const u = userEvent.setup();
    const { onClose } = renderDialog();

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});
