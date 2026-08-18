const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.E2E_EXTERNAL_SERVER === 'true' ? undefined : {
    command: 'npm start',
    url: 'http://127.0.0.1:3001/livez',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
