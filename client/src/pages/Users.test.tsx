import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import Users from './Users';
import { renderWithQuery } from '../test/renderWithQuery';

// Users renders <NavBar>, which calls useSession() and would otherwise hit the
// real better-auth client. Stub it with a stable admin session so the page
// renders without a backend.
vi.mock('../lib/auth-client', () => ({
  useSession: () => ({ data: { user: { name: 'Admin User', role: 'admin' } } }),
  signOut: vi.fn(),
  signIn: vi.fn(),
}));

// The page fetches via axios.get and reshapes failures using axios.isAxiosError.
// Mock the default export so each test can drive the request outcome.
vi.mock('axios', () => {
  const get = vi.fn();
  const isAxiosError = vi.fn();
  return { default: { get, isAxiosError } };
});

const mockedGet = vi.mocked(axios.get);
const mockedIsAxiosError = vi.mocked(axios.isAxiosError);

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
};

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'admin',
    emailVerified: true,
    image: null,
    createdAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

// Mirror the component's formatter so date assertions stay locale-agnostic.
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const renderUsers = () => renderWithQuery(<Users />);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Users page', () => {
  it('requests the user list with credentials', async () => {
    mockedGet.mockResolvedValue({ data: { users: [] } });

    renderUsers();

    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({ withCredentials: true }),
    );
  });

  it('shows skeleton placeholder rows while the request is pending', () => {
    // Never resolves: the query stays in its pending state.
    mockedGet.mockReturnValue(new Promise(() => {}));

    renderUsers();

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    // Column headers render even before data arrives.
    for (const col of ['Name', 'Email', 'Role', 'Verified', 'Created']) {
      expect(screen.getByRole('columnheader', { name: col })).toBeInTheDocument();
    }
    expect(screen.getAllByTestId('user-skeleton-row')).toHaveLength(5);
  });

  it('renders a row per user after a successful fetch', async () => {
    const users = [
      makeUser({
        id: 'u1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: 'admin',
        emailVerified: true,
        createdAt: '2024-01-15T10:00:00.000Z',
      }),
      makeUser({
        id: 'u2',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        role: 'agent',
        emailVerified: false,
        createdAt: '2024-03-02T10:00:00.000Z',
      }),
    ];
    mockedGet.mockResolvedValue({ data: { users } });

    renderUsers();

    // Wait for the first user to appear, then assert against its row.
    const adaCell = await screen.findByText('Ada Lovelace');
    const adaRow = adaCell.closest('tr')!;
    expect(within(adaRow).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(adaRow).getByText('admin')).toBeInTheDocument();
    expect(within(adaRow).getByText('Yes')).toBeInTheDocument();
    expect(
      within(adaRow).getByText(dateFormatter.format(new Date('2024-01-15T10:00:00.000Z'))),
    ).toBeInTheDocument();

    const graceRow = screen.getByText('Grace Hopper').closest('tr')!;
    expect(within(graceRow).getByText('grace@example.com')).toBeInTheDocument();
    expect(within(graceRow).getByText('agent')).toBeInTheDocument();
    expect(within(graceRow).getByText('No')).toBeInTheDocument();

    // Skeletons are gone once data has loaded.
    expect(screen.queryByTestId('user-skeleton-row')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no users', async () => {
    mockedGet.mockResolvedValue({ data: { users: [] } });

    renderUsers();

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(screen.queryByTestId('user-skeleton-row')).not.toBeInTheDocument();
  });

  it('shows an HTTP error message when the request fails with a response', async () => {
    mockedIsAxiosError.mockReturnValue(true);
    mockedGet.mockRejectedValue({ response: { status: 403 } });

    renderUsers();

    expect(await screen.findByText('Failed to load users: HTTP 403')).toBeInTheDocument();
    // The table is not rendered in the error state.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-skeleton-row')).not.toBeInTheDocument();
  });

  it('surfaces a non-HTTP error message when the request fails without a response', async () => {
    mockedIsAxiosError.mockReturnValue(false);
    mockedGet.mockRejectedValue(new Error('Network Error'));

    renderUsers();

    expect(await screen.findByText('Failed to load users: Network Error')).toBeInTheDocument();
  });
});
