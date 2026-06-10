// Runs before every test file (configured as `setupFiles` in vite.config.ts).
// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// and clears the jsdom DOM + mock state between tests.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
