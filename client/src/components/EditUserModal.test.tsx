import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import EditUserModal from './EditUserModal';
import { renderWithQuery } from '../test/renderWithQuery';

// The modal submits via axios.patch and reshapes failures with axios.isAxiosError.
vi.mock('axios', () => {
  const patch = vi.fn();
  const isAxiosError = vi.fn();
  return { default: { patch, isAxiosError } };
});

const mockedPatch = vi.mocked(axios.patch);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

const user = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };

function renderModal(onClose = vi.fn()) {
  const utils = renderWithQuery(<EditUserModal user={user} onClose={onClose} />);
  return { onClose, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditUserModal', () => {
  it('pre-fills the form with the user\'s current name and email', () => {
    renderModal();

    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('does not submit and shows validation errors for invalid input', async () => {
    const u = userEvent.setup();
    renderModal();

    await u.clear(screen.getByLabelText('Name'));
    await u.clear(screen.getByLabelText('Email'));
    await u.type(screen.getByLabelText('Email'), 'not-an-email');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it('patches the user with credentials and closes on success', async () => {
    const u = userEvent.setup();
    mockedPatch.mockResolvedValue({ data: { user } });
    const { onClose } = renderModal();

    await u.clear(screen.getByLabelText('Name'));
    await u.type(screen.getByLabelText('Name'), 'Ada L. Byron');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));
    expect(mockedPatch).toHaveBeenCalledWith(
      '/api/users/u1',
      { name: 'Ada L. Byron', email: 'ada@example.com' },
      expect.objectContaining({ withCredentials: true }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('surfaces the server error message and stays open on failure', async () => {
    const u = userEvent.setup();
    mockedIsAxiosError.mockReturnValue(true);
    mockedPatch.mockRejectedValue({
      response: { status: 409, data: { error: 'A user with that email already exists' } },
    });
    const { onClose } = renderModal();

    await u.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Failed to update user: A user with that email already exists'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when Cancel is clicked', async () => {
    const u = userEvent.setup();
    const { onClose } = renderModal();

    await u.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockedPatch).not.toHaveBeenCalled();
  });
});
