import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// A fresh client per render keeps cached query state from leaking between
// tests. `retry: false` surfaces errors immediately instead of retrying 3×.
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

/**
 * Render a component inside the providers its server-state needs: a TanStack
 * Query client plus a router (NavBar and other shared UI use react-router
 * Links). Returns the usual RTL result augmented with the `queryClient` so a
 * test can inspect or prime the cache.
 */
export function renderWithQuery(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient } = {},
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const result = render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    ),
    ...renderOptions,
  });
  return { ...result, queryClient };
}
