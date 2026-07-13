import { defineConfig, devices } from '@playwright/test';

// E2E config for local, manually-driven runs against a backend/frontend pair
// already started by the developer (see docs/context or CLAUDE.md for the
// local dev commands). Not wired into CI — this project's CI runs `pnpm build`
// + vitest only; these tests are for developers to run against a running
// stack when diagnosing UI-level bugs like the payroll autosave issue.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
