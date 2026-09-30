import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT_MS = 120_000;
const GRACEFUL_SHUTDOWN_MS = 5000;

// The throwaway container of `pnpm db:up` (see docker-compose.yml). No real secrets here.
const LOCAL_E2E_DATABASE = 'postgresql://nlm:nlm@localhost:54329/nlm_e2e';
const LOCAL_E2E_AUTH_SECRET = 'browser-tests-only-secret-0123456789abcdef';

/**
 * Browser tests run against the offline server: the real app on a real database, with the model and
 * the embedding faked (apps/api/src/e2e), serving the built web app itself. No API key, no quota.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: ORIGIN, trace: 'retain-on-failure', locale: 'de-DE' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // exec: the server replaces the shell, so Playwright's stop signal reaches it.
    command:
      'pnpm --filter @nlm/web build && cd ../api && exec node --import tsx src/e2e/server.ts',
    gracefulShutdown: { signal: 'SIGTERM', timeout: GRACEFUL_SHUTDOWN_MS },
    url: `${ORIGIN}/health`,
    timeout: STARTUP_TIMEOUT_MS,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: LOCAL_E2E_DATABASE,
      BETTER_AUTH_SECRET: LOCAL_E2E_AUTH_SECRET,
      BETTER_AUTH_URL: ORIGIN,
      PORT: String(PORT),
      // Relative to apps/api, where the server runs.
      WEB_DIST_DIR: '../web/dist',
    },
  },
});
