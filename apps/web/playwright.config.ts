import { defineConfig } from '@playwright/test';

const SERVER_PORT = 3101;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm --filter @tayan/server exec tsx src/index.ts',
      url: `http://localhost:${SERVER_PORT}/healthz`,
      env: {
        PORT: String(SERVER_PORT),
        CLIENT_ORIGIN: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
        RATE_LIMIT_PER_SEC: '100',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @tayan/web exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_SERVER_URL: `http://localhost:${SERVER_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
