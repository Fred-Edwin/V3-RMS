import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Minimal Vitest setup for pure unit tests (no DOM needed). The CSV builders in
// lib/payroll-csv.ts are pure functions, so a node environment is sufficient.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
});
