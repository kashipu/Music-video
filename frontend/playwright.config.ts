import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for BarQueue.
 */
export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false, // Better for E2E with shared DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential for DB stability
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd ../backend && set "APP_ENV=test" && set "DATABASE_PATH=data/test.db" && set "CORS_ORIGINS=http://localhost:5174" && venv\\Scripts\\uvicorn app.main:app --port 8001',
      url: 'http://localhost:8001/api/health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'set "VITE_API_URL=http://localhost:8001" && npm run dev -- --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
