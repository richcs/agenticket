import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import NewUserModal from './NewUserModal';
import { renderWithQuery } from '../test/renderWithQuery';

// The modal submits via axios.post and reshapes failures with axios.isAxiosError.
// Mock the default export so each test drives the request outcome.
vi.mock('axios', () => {
  const post = vi.fn();
  const isAxiosError = vi.fn();
  return { default: { post, isAxiosError } };
});

const mockedPost = vi.mocked(axios.post);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

function renderModal(onClose = vi.fn()) {
  const utils = renderWithQuery(<NewUserModal onClose={onClose} />);
  return { onClose, ...utils };
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { name = 'Ada Lovelace', email = 'ada@example.com', password = 'supersecret' } = {},
) {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewUserModal', () => {
  it('does not submit and shows validation errors for an empty form', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('rejects an invalid email and a too-short password', async () => {
    const user = userEvent.setup();
    renderModal();

    await fillForm(user, { email: 'not-an-email', password: 'short' });
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('posts the new user with credentials and closes on success', async () => {
    const user = userEvent.setup();
    mockedPost.mockResolvedValue({ data: { user: { id: 'u9' } } });
    const { onClose } = renderModal();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/users',
      { name: 'Ada Lovelace', email: 'ada@example.com', password: 'supersecret' },
      expect.objectContaining({ withCredentials: true }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('surfaces the server error message and stays open on failure', async () => {
    const user = userEvent.setup();
    mockedIsAxiosError.mockReturnValue(true);
    mockedPost.mockRejectedValue({
      response: { status: 409, data: { error: 'A user with that email already exists' } },
    });
    const { onClose } = renderModal();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(
      await screen.findByText('Failed to create user: A user with that email already exists'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
