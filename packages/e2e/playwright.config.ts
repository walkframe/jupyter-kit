import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 6007);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Serves the pre-built Storybook static at storybook-static/. Run
 * `pnpm --filter @jupyter-kit/storybook build:static` once before running
 * tests (or use the `storybook:build` script exposed on this package).
 *
 * Tests open individual stories via /iframe.html?id=<story-id>.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm exec serve -l ${PORT} --no-port-switching --config ./serve.json`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
