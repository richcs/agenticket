/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Port and API proxy target are env-overridable so the Playwright/E2E client
// can run on isolated ports (CLIENT_PORT) and proxy to the test server
// (API_PROXY_TARGET). Defaults match the normal dev setup.
const clientPort = Number(process.env.CLIENT_PORT ?? 5173);
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: clientPort,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Exclude the Playwright E2E specs so `vitest` only runs component tests.
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.e2e.{ts,tsx}'],
  },
});
