/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the tsconfig `@/*` -> `src/*` path alias so simulator components
    // (which import via `@/`) are runnable in tests, not just at build (tests.md §3).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['dist', 'node_modules', '.astro'],
  },
});
