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
      // plain node (no pnpm wrapper), so Playwright can stop the process when the tests end
      command: 'node --import tsx src/index.ts',
      cwd: '../server',
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
      command: `node node_modules/vite/bin/vite.js --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_SERVER_URL: `http://localhost:${SERVER_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
});
